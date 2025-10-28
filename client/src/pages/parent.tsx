import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  classBandEnum,
  searchSlotsRequestSchema,
  type AbsenceStatus,
  type ClassBand,
  type CreateAbsenceNoticeRequest,
  type ResumeAbsenceResponse,
  type SearchSlotsRequest,
  type SlotSearchResult,
} from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { Link } from "wouter";
import {
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  ListIcon,
  RefreshCcwIcon,
} from "lucide-react";

const ABSENCE_STORAGE_KEY = "absenceResumeToken";

const absenceFormSchema = z.object({
  childName: z.string().min(1, "お子様の名前を入力してください"),
  declaredClassBand: classBandEnum,
  absentDateISO: z.string().min(1, "欠席予定日を選択してください"),
  originalSlotId: z.string().min(1, "欠席するレッスン枠を選択してください"),
  contactEmail: z
    .union([z.string().email("正しいメールアドレスを入力してください"), z.literal("")])
    .optional(),
});

type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

type ClassSlotOption = {
  id: string;
  date: string;
  startTime: string;
  courseLabel: string;
  lessonStartDateTime: string;
};

type AbsenceStatusMeta = {
  label: string;
  description: string;
  badgeClass: string;
};

const ABSENCE_STATUS_META: Record<AbsenceStatus, AbsenceStatusMeta> = {
  ABSENT_LOGGED: {
    label: "欠席登録済",
    description: "振替枠を検索してご希望のレッスンを選択してください。",
    badgeClass: "bg-blue-500 text-white",
  },
  WAITING: {
    label: "順番待ち中",
    description: "現在、順番待ちに登録されています。別枠を選ぶ場合は登録済みの待ちリクエストを辞退してください。",
    badgeClass: "bg-amber-500 text-white",
  },
  MAKEUP_CONFIRMED: {
    label: "振替確定",
    description: "振替予約が確定済みです。別の枠に変更する場合は事務局までお問い合わせください。",
    badgeClass: "bg-emerald-600 text-white",
  },
  EXPIRED: {
    label: "期限切れ",
    description: "振替受付可能期間を過ぎました。新たな欠席連絡からやり直してください。",
    badgeClass: "bg-slate-500 text-white",
  },
  CANCELLED: {
    label: "取消済",
    description: "欠席連絡が取り消されています。必要であれば再度登録してください。",
    badgeClass: "bg-slate-500 text-white",
  },
};

export default function ParentPage() {
  const { toast } = useToast();
  const [absence, setAbsence] = useState<ResumeAbsenceResponse | null>(null);
  const [searchParams, setSearchParams] = useState<SearchSlotsRequest | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<SlotSearchResult | null>(null);
  const [classSlotOptions, setClassSlotOptions] = useState<ClassSlotOption[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditingAbsence, setIsEditingAbsence] = useState(false);
  const [isCheckingAbsence, setIsCheckingAbsence] = useState(true);

  const absenceForm = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      childName: "",
      declaredClassBand: undefined,
      absentDateISO: "",
      originalSlotId: "",
      contactEmail: "",
    },
    mode: "onChange",
  });

  const searchForm = useForm<SearchSlotsRequest>({
    resolver: zodResolver(searchSlotsRequestSchema),
    defaultValues: {
      childName: "",
      declaredClassBand: undefined as unknown as ClassBand,
      absentDateISO: "",
      absenceToken: "",
    },
    mode: "onChange",
  });

  const watchClassBand = absenceForm.watch("declaredClassBand");
  const watchAbsentDate = absenceForm.watch("absentDateISO");

  const loadClassSlots = useCallback(
    async (classBand?: ClassBand, absentDateISO?: string) => {
      if (!classBand || !absentDateISO) {
        setClassSlotOptions([]);
        absenceForm.setValue("originalSlotId", "");
        return;
      }

      setIsFetchingSlots(true);
      try {
        const response = await apiRequest(
          "GET",
          `/api/class-slots?date=${encodeURIComponent(absentDateISO)}&classBand=${encodeURIComponent(classBand)}`
        );
        const slots: ClassSlotOption[] = response?.slots ?? [];
        const currentBand = absenceForm.getValues("declaredClassBand");
        const currentDate = absenceForm.getValues("absentDateISO");

        if (currentBand !== classBand || currentDate !== absentDateISO) {
          return;
        }

        setClassSlotOptions(slots);
        const currentSelection = absenceForm.getValues("originalSlotId");
        const nextSelection =
          currentSelection && slots.some((slot) => slot.id === currentSelection)
            ? currentSelection
            : slots[0]?.id ?? "";

        absenceForm.setValue("originalSlotId", nextSelection, { shouldValidate: true });
      } catch (error: any) {
        toast({
          title: "枠情報の取得に失敗しました",
          description: error.message ?? "レッスン枠の取得に失敗しました。",
          variant: "destructive",
        });
        setClassSlotOptions([]);
        absenceForm.setValue("originalSlotId", "");
      } finally {
        setIsFetchingSlots(false);
      }
    },
    [absenceForm, toast]
  );

  useEffect(() => {
    loadClassSlots(watchClassBand, watchAbsentDate);
  }, [watchClassBand, watchAbsentDate, loadClassSlots]);

  const setFormsFromAbsence = useCallback(
    (data: ResumeAbsenceResponse) => {
      const contactEmail = data.contactEmail ?? "";
      absenceForm.reset({
        childName: data.childName,
        declaredClassBand: data.declaredClassBand,
        absentDateISO: data.absentDateISO,
        originalSlotId: data.originalSlotId,
        contactEmail,
      });
      searchForm.reset({
        childName: data.childName,
        declaredClassBand: data.declaredClassBand,
        absentDateISO: data.absentDateISO,
        absenceToken: data.resumeToken,
      });
      setSelectedDate(new Date(data.absentDateISO));
      setViewMode("list");
      loadClassSlots(data.declaredClassBand, data.absentDateISO);
    },
    [absenceForm, searchForm, loadClassSlots]
  );

  const loadAbsence = useCallback(
    async (token: string, options?: { notify?: boolean }) => {
      try {
        const response = await apiRequest("GET", `/api/absences/${encodeURIComponent(token)}`);
        const fetched: ResumeAbsenceResponse = response.absence;
        setAbsence(fetched);
        setFormsFromAbsence(fetched);
        localStorage.setItem(ABSENCE_STORAGE_KEY, token);
        setIsEditingAbsence(false);
        if (options?.notify) {
          toast({
            title: "欠席情報を読み込みました",
            description: `${fetched.childName} さんの欠席連絡を再開しました。`,
          });
        }
      } catch (error: any) {
        localStorage.removeItem(ABSENCE_STORAGE_KEY);
        setAbsence(null);
        if (options?.notify !== false) {
          toast({
            title: "欠席情報の取得に失敗しました",
            description: error.message ?? "再度欠席連絡を登録してください。",
            variant: "destructive",
          });
        }
        throw error;
      } finally {
        setIsCheckingAbsence(false);
      }
    },
    [setFormsFromAbsence, toast]
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = searchParams.get("token");
    const tokenFromStorage = localStorage.getItem(ABSENCE_STORAGE_KEY);
    const tokenToUse = tokenFromUrl || tokenFromStorage;

    if (tokenFromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }

    if (!tokenToUse) {
      setIsCheckingAbsence(false);
      return;
    }

    loadAbsence(tokenToUse, { notify: !!tokenFromUrl }).catch(() => {
      // handled inside loadAbsence
    });
  }, [loadAbsence]);

  const { data: slots, isLoading: isSearching, error: searchError } = useQuery<SlotSearchResult[]>({
    queryKey: ["/api/search-slots", searchParams],
    enabled: !!searchParams,
    queryFn: async () => {
      if (!searchParams) return [];
      return (await apiRequest("POST", "/api/search-slots", searchParams)) as SlotSearchResult[];
    },
  });

  if (searchError) {
    console.error("検索エラー:", searchError);
  }

  const absenceStatusMeta = absence ? ABSENCE_STATUS_META[absence.makeupStatus] : null;
  const canSearch =
    absence &&
    (absence.makeupStatus === "ABSENT_LOGGED" || absence.makeupStatus === "WAITING" || absence.makeupStatus === "CANCELLED");

  const onSubmitAbsence = async (values: AbsenceFormValues) => {
    const payload: CreateAbsenceNoticeRequest = {
      childName: values.childName,
      declaredClassBand: values.declaredClassBand,
      absentDateISO: values.absentDateISO,
      originalSlotId: values.originalSlotId,
      contactEmail:
        values.contactEmail && values.contactEmail.trim() !== "" ? values.contactEmail.trim() : undefined,
    };

    try {
      const response = await apiRequest("POST", "/api/absences", payload);
      const updatedAbsence: ResumeAbsenceResponse = response.absence;
      setAbsence(updatedAbsence);
      setFormsFromAbsence(updatedAbsence);
      localStorage.setItem(ABSENCE_STORAGE_KEY, updatedAbsence.resumeToken);
      setIsEditingAbsence(false);
      toast({
        title: "欠席連絡を保存しました",
        description: `${updatedAbsence.childName} さんの欠席を登録しました。`,
      });
    } catch (error: any) {
      toast({
        title: "欠席連絡の登録に失敗しました",
        description: error.message ?? "情報を確認して再度お試しください。",
        variant: "destructive",
      });
    }
  };

  const onSearch = (_data: SearchSlotsRequest) => {
    if (!absence) {
      toast({
        title: "欠席連絡を先に登録してください",
        description: "欠席連絡を済ませると振替枠を検索できます。",
        variant: "destructive",
      });
      return;
    }

    const params: SearchSlotsRequest = {
      childName: absence.childName,
      declaredClassBand: absence.declaredClassBand,
      absentDateISO: absence.absentDateISO,
      absenceToken: absence.resumeToken,
    };

    setSearchParams(params);
    setSelectedDate(new Date(absence.absentDateISO));
    setViewMode("list");
  };

  const handleBook = async (slotId: string) => {
    if (!absence) return;

    try {
      const result = await apiRequest("POST", "/api/book", {
        childName: absence.childName,
        declaredClassBand: absence.declaredClassBand,
        absentDateISO: absence.absentDateISO,
        toSlotId: slotId,
        absenceToken: absence.resumeToken,
      });

      toast({
        title: "予約完了",
        description: result.message || "振替予約が成立しました。",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/search-slots"] });
      await loadAbsence(absence.resumeToken, { notify: false });
    } catch (error: any) {
      toast({
        title: "予約エラー",
        description: error.message || "予約に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleWaitlistSuccess = async () => {
    if (!absence) return;
    await loadAbsence(absence.resumeToken, { notify: false });
    setWaitlistSlot(null);
    queryClient.invalidateQueries({ queryKey: ["/api/search-slots"] });
  };

  const handleResetAbsence = () => {
    localStorage.removeItem(ABSENCE_STORAGE_KEY);
    setAbsence(null);
    setSearchParams(null);
    setClassSlotOptions([]);
    setWaitlistSlot(null);
    setSelectedDate(undefined);
    setIsEditingAbsence(false);
    absenceForm.reset({
      childName: "",
      declaredClassBand: undefined,
      absentDateISO: "",
      originalSlotId: "",
      contactEmail: "",
    });
    searchForm.reset({
      childName: "",
      declaredClassBand: undefined as unknown as ClassBand,
      absentDateISO: "",
      absenceToken: "",
    });
    toast({
      title: "欠席情報をリセットしました",
      description: "新しい欠席連絡から始められます。",
    });
  };

  const absenceDeadline = useMemo(() => {
    if (!absence) return null;
    return format(new Date(absence.makeupDeadlineISO), "yyyy年M月d日(E)", { locale: ja });
  }, [absence]);

  const absenceSummaryDate = useMemo(() => {
    if (!absence) return null;
    return format(new Date(absence.absentDateISO), "yyyy年M月d日(E)", { locale: ja });
  }, [absence]);

  const displayedSlots = slots ?? [];

  if (isCheckingAbsence) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 border-b-2 border-primary rounded-full animate-spin" />
          <p>欠席情報を確認しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-6">
          <h1 className="text-xl font-bold">水泳教室 振替予約</h1>
        </div>
      </header>

      <main className="container max-w-4xl px-4 py-8 md:py-12">
        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">STEP 1</p>
            <h2 className="text-2xl font-semibold">欠席連絡</h2>
          </div>
          <Card className="border-2">
            <CardContent className="p-6">
              {!absence || isEditingAbsence ? (
                <Form {...absenceForm}>
                  <form onSubmit={absenceForm.handleSubmit(onSubmitAbsence)} className="space-y-4">
                    <FormField
                      control={absenceForm.control}
                      name="childName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">お子様の名前</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                              <Input
                                {...field}
                                data-testid="absence-input-childname"
                                placeholder="例：山田太郎"
                                className="h-12 pl-10 border-2"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={absenceForm.control}
                        name="declaredClassBand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold">クラス帯</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="absence-select-classband" className="h-12 border-2">
                                  <SelectValue placeholder="選択してください" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="初級">初級</SelectItem>
                                <SelectItem value="中級">中級</SelectItem>
                                <SelectItem value="上級">上級</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={absenceForm.control}
                        name="absentDateISO"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold">欠席予定日</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                <Input
                                  {...field}
                                  type="date"
                                  data-testid="absence-input-absentdate"
                                  className="h-12 pl-10 border-2"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={absenceForm.control}
                      name="originalSlotId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">欠席するレッスン枠</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={classSlotOptions.length === 0 || isFetchingSlots}>
                            <FormControl>
                              <SelectTrigger data-testid="absence-select-slot" className="h-12 border-2">
                                <SelectValue placeholder={isFetchingSlots ? "読み込み中..." : "選択してください"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {classSlotOptions.length === 0 && !isFetchingSlots ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">枠が見つかりませんでした</div>
                              ) : (
                                classSlotOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {format(new Date(option.lessonStartDateTime), "H:mm")}／{option.courseLabel}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={absenceForm.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">連絡用メールアドレス（任意）</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              inputMode="email"
                              placeholder="example@email.com"
                              className="h-12 border-2"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm text-muted-foreground">
                        登録後、振替受付期限
                        {absenceDeadline ? `（${absenceDeadline}まで）` : ""}
                        に振替枠を検索できます。
                      </p>
                      <div className="flex gap-3">
                        {absence && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsEditingAbsence(false)}
                            className="border-2"
                          >
                            キャンセル
                          </Button>
                        )}
                        <Button type="submit" className="h-12 px-6 text-base font-semibold" data-testid="absence-submit">
                          {absence ? "欠席内容を更新" : "欠席連絡を登録"}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{absence.childName} さん</h3>
                      <p className="text-sm text-muted-foreground">
                        欠席日：{absenceSummaryDate}／クラス帯：{absence.declaredClassBand}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        受講枠：{format(new Date(absence.originalSlot.lessonStartDateTime), "H:mm")}／{absence.originalSlot.courseLabel}
                      </p>
                      {absenceDeadline && (
                        <p className="text-sm text-muted-foreground mt-1">振替受付期限：{absenceDeadline}</p>
                      )}
                    </div>
                    {absenceStatusMeta && (
                      <Badge className={`${absenceStatusMeta.badgeClass} text-sm px-3 py-1`}>{absenceStatusMeta.label}</Badge>
                    )}
                  </div>
                  {absenceStatusMeta && (
                    <div className="rounded-lg border bg-muted/60 p-4 text-sm text-muted-foreground">
                      {absenceStatusMeta.description}
                    </div>
                  )}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs text-muted-foreground">
                      再開用リンク：
                      <span className="font-mono select-all break-all">
                        {`${window.location.origin}?token=${absence.resumeToken}`}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditingAbsence(true)}
                        className="border-2"
                      >
                        欠席内容を編集
                      </Button>
                      <Button type="button" variant="outline" onClick={handleResetAbsence} className="border-2">
                        リセット
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">STEP 2</p>
              <h2 className="text-2xl font-semibold">振替枠を検索</h2>
            </div>
            {absence && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCcwIcon className="h-4 w-4" />
                <span>欠席連絡をもとに検索できます</span>
              </div>
            )}
          </div>

          {!absence ? (
            <Card className="border-2 border-dashed bg-muted/40">
              <CardContent className="p-12 text-center text-muted-foreground">
                欠席連絡を登録すると振替可能な枠を検索できます。
              </CardContent>
            </Card>
          ) : absence.makeupStatus === "MAKEUP_CONFIRMED" ? (
            <Card className="border-2 bg-muted/40">
              <CardContent className="p-12 text-center text-muted-foreground">
                すでに振替予約が確定済みです。別の枠への変更は事務局へお問い合わせください。
              </CardContent>
            </Card>
          ) : absence.makeupStatus === "EXPIRED" ? (
            <Card className="border-2 bg-muted/40">
              <CardContent className="p-12 text-center text-muted-foreground">
                振替の受付期限が過ぎています。新しい欠席連絡からやり直してください。
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2">
              <CardContent className="p-6">
                <Form {...searchForm}>
                  <form onSubmit={searchForm.handleSubmit(onSearch)} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={searchForm.control}
                        name="childName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold">お子様の名前</FormLabel>
                            <FormControl>
                              <Input {...field} readOnly className="h-12 border-2 bg-muted" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={searchForm.control}
                        name="declaredClassBand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold">クラス帯</FormLabel>
                            <FormControl>
                              <Input {...field} readOnly className="h-12 border-2 bg-muted" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={searchForm.control}
                        name="absentDateISO"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-semibold">欠席日</FormLabel>
                            <FormControl>
                              <Input {...field} readOnly className="h-12 border-2 bg-muted" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Input type="hidden" {...searchForm.register("absenceToken")} />

                    <Button
                      type="submit"
                      data-testid="button-search"
                      className="w-full h-12 text-base font-semibold"
                      disabled={isSearching}
                    >
                      {isSearching ? "検索中..." : "検索"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {canSearch && searchParams && (
            <section className="mt-8">
              <h3 className="text-2xl font-semibold mb-6">検索結果</h3>

              {isSearching && (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {!isSearching && displayedSlots.length === 0 && (
                <Card className="border-2">
                  <CardContent className="p-12 text-center">
                    <ClockIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg text-muted-foreground">条件に合う振替枠が見つかりませんでした</p>
                  </CardContent>
                </Card>
              )}

              {!isSearching && displayedSlots.length > 0 && (
                <Card className="border-2">
                  <CardHeader className="p-6 flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <h4 className="text-2xl font-bold">検索結果</h4>
                      <p className="text-sm text-muted-foreground mt-1">{displayedSlots.length}件の振替可能枠が見つかりました</p>
                    </div>
                    <div className="flex border-2 rounded-lg overflow-hidden">
                      <Button
                        variant={viewMode === "list" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="rounded-none"
                      >
                        <ListIcon className="w-4 h-4 mr-2" />
                        リスト
                      </Button>
                      <Button
                        variant={viewMode === "calendar" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("calendar")}
                        className="rounded-none"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        カレンダー
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    {viewMode === "calendar" ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="flex justify-center">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md border"
                            modifiers={{
                              hasSlots: displayedSlots.map((slot) => new Date(slot.date)),
                            }}
                            modifiersStyles={{
                              hasSlots: {
                                fontWeight: "bold",
                                backgroundColor: "hsl(var(--primary) / 0.1)",
                              },
                            }}
                          />
                        </div>
                        <div className="space-y-4">
                          {selectedDate ? (
                            (() => {
                              const selectedYear = selectedDate.getFullYear();
                              const selectedMonth = selectedDate.getMonth();
                              const selectedDay = selectedDate.getDate();

                              const daySlots = displayedSlots.filter((slot) => {
                                const slotDate = new Date(slot.date);
                                return (
                                  slotDate.getFullYear() === selectedYear &&
                                  slotDate.getMonth() === selectedMonth &&
                                  slotDate.getDate() === selectedDay
                                );
                              });

                              if (daySlots.length === 0) {
                                return (
                                  <div className="text-center py-12">
                                    <p className="text-muted-foreground">
                                      {format(selectedDate, "M月d日(E)", { locale: ja })}の枠はありません
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <>
                                  <h3 className="text-lg font-bold">
                                    {format(selectedDate, "yyyy年M月d日(E)", { locale: ja })}
                                  </h3>
                                  <div className="space-y-3">
                                    {daySlots
                                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                      .map((slot) => (
                                        <SlotCard
                                          key={slot.slotId}
                                          slot={slot}
                                          onBook={handleBook}
                                          onWaitlist={setWaitlistSlot}
                                        />
                                      ))}
                                  </div>
                                </>
                              );
                            })()
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">日付を選択してください</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedSlots.map((slot) => (
                          <SlotCard key={slot.slotId} slot={slot} onBook={handleBook} onWaitlist={setWaitlistSlot} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </section>
      </main>

      {absence && waitlistSlot && searchParams && (
        <WaitlistDialog
          slot={waitlistSlot}
          searchParams={searchParams}
          contactEmail={absence.contactEmail ?? ""}
          open={!!waitlistSlot}
          onOpenChange={(open) => {
            if (!open) setWaitlistSlot(null);
          }}
          onSuccess={handleWaitlistSuccess}
        />
      )}

      <Link href="/admin">
        <Button
          data-testid="link-admin"
          className="fixed bottom-6 right-6 h-14 px-6 text-base font-semibold shadow-lg"
          variant="outline"
        >
          管理画面
        </Button>
      </Link>
    </div>
  );
}

type SlotCardProps = {
  slot: SlotSearchResult;
  onBook: (slotId: string) => void;
  onWaitlist: (slot: SlotSearchResult) => void;
};

function SlotCard({ slot, onBook, onWaitlist }: SlotCardProps) {
  return (
    <Card className="border-2 hover:border-primary/50 transition-all" data-testid={`slot-card-${slot.slotId}`}>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-base">
                {format(new Date(slot.date), "yyyy年M月d日(E)", { locale: ja })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{slot.startTime}</span>
              <Badge variant="outline">{slot.classBand}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{slot.courseLabel}</p>
          </div>
          <div className="text-right">
            <Badge
              className={
                slot.statusCode === "〇"
                  ? "bg-green-500 hover:bg-green-600"
                  : slot.statusCode === "△"
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-red-500 hover:bg-red-600"
              }
            >
              {slot.statusCode}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="bg-muted/50 rounded-lg p-3 mb-3">
          <p className="text-sm font-medium">{slot.statusText}</p>
          {slot.waitlistCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <ClockIcon className="w-3 h-3" />
              <span>現在 {slot.waitlistCount} 名待ち</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-center p-2 bg-background rounded border">
            <p className="text-xs text-muted-foreground mb-1">定員</p>
            <p className="font-bold">{slot.capacityLimit || "-"}</p>
          </div>
          <div className="text-center p-2 bg-background rounded border">
            <p className="text-xs text-muted-foreground mb-1">参加者</p>
            <p className="font-bold">{slot.capacityCurrent || "-"}</p>
          </div>
          <div className="text-center p-2 bg-background rounded border">
            <p className="text-xs text-muted-foreground mb-1">残り枠</p>
            <p className="font-bold text-primary">{slot.remainingSlots}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {slot.statusCode === "〇" || slot.statusCode === "△" ? (
          <Button onClick={() => onBook(slot.slotId)} className="w-full h-11" data-testid={`button-book-${slot.slotId}`}>
            <CheckCircleIcon className="w-4 h-4 mr-2" />
            この枠で振替予約
          </Button>
        ) : (
          <Button
            onClick={() => onWaitlist(slot)}
            variant="outline"
            className="w-full h-11"
            data-testid={`button-waitlist-${slot.slotId}`}
          >
            <AlertTriangleIcon className="w-4 h-4 mr-2" />
            キャンセル待ちに登録
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
