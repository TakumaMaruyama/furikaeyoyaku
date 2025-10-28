import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { searchSlotsRequestSchema, type SearchSlotsRequest, type SlotSearchResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, UserIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon, ListIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { Link } from "wouter";
import { Calendar } from "@/components/ui/calendar";

export default function ParentPage() {
  const [searchParams, setSearchParams] = useState<SearchSlotsRequest | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<SlotSearchResult | null>(null);
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const form = useForm<any>({
    resolver: zodResolver(searchSlotsRequestSchema),
    defaultValues: {
      childName: "",
      declaredClassBand: undefined,
      absentDateISO: "",
    },
    mode: "onChange",
  });

  const { data: slots, isLoading, error } = useQuery<SlotSearchResult[]>({
    queryKey: ["/api/search-slots", searchParams],
    enabled: !!searchParams,
    queryFn: async () => {
      if (!searchParams) return [];
      return await apiRequest("POST", "/api/search-slots", searchParams) as SlotSearchResult[];
    },
  });

  if (error) {
    console.error("検索エラー:", error);
  }

  const onSearch = (data: SearchSlotsRequest) => {
    setSearchParams(data);
    if (data.absentDateISO) {
      setSelectedDate(new Date(data.absentDateISO));
    }
    setViewMode("list"); // Reset to list view on new search
  };

  const handleBook = async (slotId: string) => {
    if (!searchParams) return;

    try {
      const result = await apiRequest("POST", "/api/book", {
        childName: searchParams.childName,
        declaredClassBand: searchParams.declaredClassBand,
        absentDateISO: searchParams.absentDateISO,
        toSlotId: slotId,
      });

      toast({
        title: "予約完了",
        description: result.message || "振替予約が成立しました。",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/search-slots"] });
    } catch (error: any) {
      toast({
        title: "予約エラー",
        description: error.message || "予約に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (statusCode: string) => {
    switch (statusCode) {
      case "〇":
        return <CheckCircleIcon className="w-5 h-5" />;
      case "△":
        return <AlertTriangleIcon className="w-5 h-5" />;
      case "×":
        return <ClockIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStatusColor = (statusCode: string) => {
    switch (statusCode) {
      case "〇":
        return "bg-success/10 text-success border-success/20";
      case "△":
        return "bg-warning/10 text-warning border-warning/20";
      case "×":
        return "bg-info/10 text-info border-info/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-6">
          <h1 className="text-xl font-bold">水泳教室 振替予約</h1>
        </div>
      </header>

      <main className="container max-w-2xl px-4 py-8 md:py-12">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">振替枠を検索</h2>
          <Card className="border-2">
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSearch)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="childName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">お子様の名前</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              {...field}
                              data-testid="input-childname"
                              placeholder="例：山田太郎"
                              className="h-12 pl-10 border-2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="declaredClassBand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">クラス帯</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-classband" className="h-12 border-2">
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
                    control={form.control}
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
                              data-testid="input-absentdate"
                              className="h-12 pl-10 border-2"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    data-testid="button-search"
                    className="w-full h-12 text-base font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? "検索中..." : "検索"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>

        {searchParams && (
          <section>
            <h2 className="text-2xl font-semibold mb-6">検索結果</h2>

            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {!isLoading && slots && slots.length === 0 && (
              <Card className="border-2">
                <CardContent className="p-12 text-center">
                  <ClockIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">
                    条件に合う振替枠が見つかりませんでした
                  </p>
                </CardContent>
              </Card>
            )}

            {slots && slots.length > 0 && (
              <Card className="border-2">
                <CardHeader className="p-6 flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <h2 className="text-2xl font-bold">検索結果</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {slots.length}件の振替可能枠が見つかりました
                    </p>
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
                  {viewMode === "calendar" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="flex justify-center">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          className="rounded-md border"
                          modifiers={{
                            hasSlots: slots.map(slot => new Date(slot.date)),
                          }}
                          modifiersStyles={{
                            hasSlots: {
                              fontWeight: 'bold',
                              backgroundColor: 'hsl(var(--primary) / 0.1)',
                            },
                          }}
                        />
                      </div>
                      <div className="space-y-4">
                        {selectedDate && (() => {
                          const selectedYear = selectedDate.getFullYear();
                          const selectedMonth = selectedDate.getMonth();
                          const selectedDay = selectedDate.getDate();

                          const daySlots = slots.filter(slot => {
                            const slotDate = new Date(slot.date);
                            return slotDate.getFullYear() === selectedYear &&
                                   slotDate.getMonth() === selectedMonth &&
                                   slotDate.getDate() === selectedDay;
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
                        })()}
                      </div>
                    </div>
                  )}
                  {viewMode === "list" && (
                    <div className="space-y-4">
                      {slots.map((slot) => (
                        <SlotCard
                          key={slot.slotId}
                          slot={slot}
                          onBook={handleBook}
                          onWaitlist={setWaitlistSlot}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        )}
      </main>

      {waitlistSlot && (
        <WaitlistDialog
          slot={waitlistSlot}
          searchParams={searchParams!}
          open={!!waitlistSlot}
          onOpenChange={(open) => !open && setWaitlistSlot(null)}
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
    <Card
      className="border-2 hover:border-primary/50 transition-all"
      data-testid={`slot-card-${slot.slotId}`}
    >
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
            <p className="font-bold">{slot.capacityLimit || '-'}</p>
          </div>
          <div className="text-center p-2 bg-background rounded border">
            <p className="text-xs text-muted-foreground mb-1">参加者</p>
            <p className="font-bold">{slot.capacityCurrent || '-'}</p>
          </div>
          <div className="text-center p-2 bg-background rounded border">
            <p className="text-xs text-muted-foreground mb-1">残り枠</p>
            <p className="font-bold text-primary">{slot.remainingSlots}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        {slot.statusCode === "〇" || slot.statusCode === "△" ? (
          <Button
            onClick={() => onBook(slot.slotId)}
            className="w-full h-11"
            data-testid={`button-book-${slot.slotId}`}
          >
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