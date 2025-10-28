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
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, UserIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WaitlistDialog } from "@/components/waitlist-dialog";

export default function ParentPage() {
  const [searchParams, setSearchParams] = useState<SearchSlotsRequest | null>(null);
  const [waitlistSlot, setWaitlistSlot] = useState<SlotSearchResult | null>(null);
  const { toast } = useToast();

  const form = useForm<SearchSlotsRequest>({
    resolver: zodResolver(searchSlotsRequestSchema),
    defaultValues: {
      childName: "",
      declaredClassBand: undefined,
      absentDateISO: "",
    },
  });

  const { data: slots, isLoading } = useQuery<SlotSearchResult[]>({
    queryKey: ["/api/search-slots", searchParams],
    enabled: !!searchParams,
    queryFn: async () => {
      if (!searchParams) return [];
      const response = await apiRequest("POST", "/api/search-slots", searchParams);
      return response as SlotSearchResult[];
    },
  });

  const onSearch = (data: SearchSlotsRequest) => {
    setSearchParams(data);
  };

  const handleBook = async (slot: SlotSearchResult) => {
    if (!searchParams) return;

    try {
      const result = await apiRequest("POST", "/api/book", {
        childName: searchParams.childName,
        declaredClassBand: searchParams.declaredClassBand,
        absentDateISO: searchParams.absentDateISO,
        toSlotId: slot.slotId,
      });

      toast({
        title: "予約完了",
        description: (result as any).message || "振替予約が成立しました。",
      });
      
      setSearchParams({ ...searchParams });
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
              <form onSubmit={form.handleSubmit(onSearch)} className="space-y-4">
                <div>
                  <Label htmlFor="childName" className="font-semibold mb-2 block">
                    お子様の名前
                  </Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="childName"
                      data-testid="input-childname"
                      {...form.register("childName")}
                      placeholder="例：山田太郎"
                      className="h-12 pl-10 border-2"
                    />
                  </div>
                  {form.formState.errors.childName && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.childName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="classBand" className="font-semibold mb-2 block">
                    クラス帯
                  </Label>
                  <Select
                    onValueChange={(value) => form.setValue("declaredClassBand", value as any)}
                  >
                    <SelectTrigger id="classBand" data-testid="select-classband" className="h-12 border-2">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="初級">初級</SelectItem>
                      <SelectItem value="中級">中級</SelectItem>
                      <SelectItem value="上級">上級</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.declaredClassBand && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.declaredClassBand.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="absentDate" className="font-semibold mb-2 block">
                    欠席予定日
                  </Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="absentDate"
                      data-testid="input-absentdate"
                      type="date"
                      {...form.register("absentDateISO")}
                      className="h-12 pl-10 border-2"
                    />
                  </div>
                  {form.formState.errors.absentDateISO && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.absentDateISO.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  data-testid="button-search"
                  className="w-full h-12 text-base font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? "検索中..." : "検索"}
                </Button>
              </form>
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

            {!isLoading && slots && slots.length > 0 && (
              <div className="space-y-4">
                {slots.map((slot) => (
                  <Card key={slot.slotId} className="border-2 hover-elevate" data-testid={`card-slot-${slot.slotId}`}>
                    <CardHeader className="p-6 pb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          className={`${getStatusColor(slot.statusCode)} border-2 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5`}
                        >
                          {getStatusIcon(slot.statusCode)}
                          {slot.statusCode} {slot.statusText}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold" data-testid={`text-courselabel-${slot.slotId}`}>
                        {slot.courseLabel}
                      </h3>
                      <p className="text-base text-muted-foreground font-medium">
                        {slot.classBand}
                      </p>
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                      <div className="flex items-center gap-4 text-base">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(slot.date), "yyyy年M月d日(E)", { locale: ja })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">{slot.startTime}</span>
                        </div>
                      </div>
                      {slot.statusCode === "×" && (
                        <p className="text-sm text-muted-foreground mt-2">
                          現在 {slot.waitlistCount} 名待ち
                        </p>
                      )}
                    </CardContent>
                    <CardFooter className="p-6 pt-0">
                      {(slot.statusCode === "〇" || slot.statusCode === "△") && (
                        <Button
                          onClick={() => handleBook(slot)}
                          data-testid={`button-book-${slot.slotId}`}
                          className="w-full h-12 text-base font-semibold"
                        >
                          予約する
                        </Button>
                      )}
                      {slot.statusCode === "×" && (
                        <Button
                          variant="outline"
                          onClick={() => setWaitlistSlot(slot)}
                          data-testid={`button-waitlist-${slot.slotId}`}
                          className="w-full h-12 text-base font-semibold border-2"
                        >
                          順番待ちで申し込む
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {waitlistSlot && searchParams && (
        <WaitlistDialog
          slot={waitlistSlot}
          searchParams={searchParams}
          open={!!waitlistSlot}
          onOpenChange={(open) => !open && setWaitlistSlot(null)}
          onSuccess={() => {
            setSearchParams({ ...searchParams });
            setWaitlistSlot(null);
          }}
        />
      )}
    </div>
  );
}
