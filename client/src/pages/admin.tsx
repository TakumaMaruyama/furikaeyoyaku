import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircleIcon, ClockIcon, XCircleIcon, ListIcon, CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import type { HolidayResponse } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";

type Request = {
  id: string;
  childName: string;
  declaredClassBand: string;
  absentDate: string;
  toSlotId: string;
  status: string;
  contactEmail: string | null;
  toSlotStartDateTime: string;
  createdAt: string;
};

type ClassSlot = {
  id: string;
  date: string;
  startTime: string;
  courseLabel: string;
  classBand: string;
  capacityLimit: number;
  capacityCurrent: number;
  capacityMakeupAllowed: number;
  capacityMakeupUsed: number;
  waitlistCount?: number;
  lessonStartDateTime: string;
};

type WaitingRequest = {
  slotId: string;
  slot: ClassSlot;
  requests: Request[];
};

export default function AdminPage() {
  const { toast } = useToast();
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [capacityValues, setCapacityValues] = useState<Record<string, any>>({});
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [editingSlotData, setEditingSlotData] = useState<ClassSlot | null>(null);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: confirmedRequests, isLoading: loadingConfirmed } = useQuery<Request[]>({
    queryKey: ["/api/admin/confirmed"],
  });

  const { data: waitingData, isLoading: loadingWaiting } = useQuery<WaitingRequest[]>({
    queryKey: ["/api/admin/waiting"],
  });

  const { data: allSlots, isLoading: loadingSlots } = useQuery<ClassSlot[]>({
    queryKey: ["/api/admin/slots"],
  });

  const { data: holidays, isLoading: loadingHolidays } = useQuery<HolidayResponse[]>({
    queryKey: ["/api/admin/holidays"],
  });

  const updateCapacityMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/admin/update-slot-capacity", data),
    onSuccess: () => {
      toast({
        title: "更新完了",
        description: "枠容量を更新しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiting"] });
      setEditingSlot(null);
      setCapacityValues({});
    },
    onError: (error: any) => {
      toast({
        title: "更新エラー",
        description: error.message || "更新に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const closeWaitlistMutation = useMutation({
    mutationFn: (slotId: string) => apiRequest("POST", "/admin/close-waitlist", { slotId }),
    onSuccess: () => {
      toast({
        title: "クローズ完了",
        description: "待ちリストをクローズしました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waiting"] });
    },
    onError: (error: any) => {
      toast({
        title: "クローズエラー",
        description: error.message || "クローズに失敗しました。",
        variant: "destructive",
      });
    },
  });

  const createSlotMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/create-slot", data),
    onSuccess: (response: any) => {
      const description = response.count 
        ? `${response.count}個の枠を作成しました。`
        : "新しい枠を作成しました。";
      
      toast({
        title: "作成完了",
        description,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slots"] });
      setShowSlotDialog(false);
      setEditingSlotData(null);
    },
    onError: (error: any) => {
      toast({
        title: "作成エラー",
        description: error.message || "作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/admin/update-slot", data),
    onSuccess: () => {
      toast({
        title: "更新完了",
        description: "枠を更新しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slots"] });
      setShowSlotDialog(false);
      setEditingSlotData(null);
    },
    onError: (error: any) => {
      toast({
        title: "更新エラー",
        description: error.message || "更新に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", "/api/admin/delete-slot", { id }),
    onSuccess: () => {
      toast({
        title: "削除完了",
        description: "枠を削除しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slots"] });
    },
    onError: (error: any) => {
      toast({
        title: "削除エラー",
        description: error.message || "削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const createHolidayMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/create-holiday", data),
    onSuccess: () => {
      toast({
        title: "登録完了",
        description: "休館日を登録しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/holidays"] });
      setShowHolidayDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "登録エラー",
        description: error.message || "登録に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", "/api/admin/delete-holiday", { id }),
    onSuccess: () => {
      toast({
        title: "削除完了",
        description: "休館日を削除しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/holidays"] });
    },
    onError: (error: any) => {
      toast({
        title: "削除エラー",
        description: error.message || "削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleEditSlot = (slotId: string, slot: ClassSlot) => {
    setEditingSlot(slotId);
    setCapacityValues({
      [slotId]: {
        capacityMakeupAllowed: slot.capacityMakeupAllowed,
        capacityMakeupUsed: slot.capacityMakeupUsed,
      },
    });
  };

  const handleSaveCapacity = (slotId: string) => {
    const values = capacityValues[slotId];
    if (!values) return;

    updateCapacityMutation.mutate({
      slotId,
      capacityMakeupAllowed: parseInt(values.capacityMakeupAllowed),
      capacityMakeupUsed: parseInt(values.capacityMakeupUsed),
    });
  };

  const handleCloseWaitlist = (slotId: string) => {
    if (confirm("この枠の待ちリストをクローズしますか？未案内の待ち者に通知メールが送信されます。")) {
      closeWaitlistMutation.mutate(slotId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-6">
          <h1 className="text-xl font-bold">管理画面</h1>
        </div>
      </header>

      <main className="container px-4 py-8 md:py-12">
        <Tabs defaultValue="confirmed" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-3 h-12">
            <TabsTrigger value="confirmed" data-testid="tab-confirmed" className="text-base">
              確定一覧
            </TabsTrigger>
            <TabsTrigger value="waiting" data-testid="tab-waiting" className="text-base">
              待ち一覧
            </TabsTrigger>
            <TabsTrigger value="slots" data-testid="tab-slots" className="text-base">
              枠管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed" className="mt-6">
            <Card className="border-2">
              <CardHeader className="p-6">
                <CardTitle className="text-xl">確定済み振替リクエスト</CardTitle>
                <p className="text-sm text-muted-foreground">
                  既存管理システムへの手入力用データ
                </p>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {loadingConfirmed && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}

                {!loadingConfirmed && confirmedRequests && confirmedRequests.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">確定済みのリクエストはありません</p>
                  </div>
                )}

                {!loadingConfirmed && confirmedRequests && confirmedRequests.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">お子様名</TableHead>
                          <TableHead className="font-semibold">クラス帯</TableHead>
                          <TableHead className="font-semibold">欠席日</TableHead>
                          <TableHead className="font-semibold">振替先</TableHead>
                          <TableHead className="font-semibold">振替日時</TableHead>
                          <TableHead className="font-semibold">申込日時</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {confirmedRequests.map((req) => (
                          <TableRow key={req.id} data-testid={`row-confirmed-${req.id}`}>
                            <TableCell className="font-medium">{req.childName}</TableCell>
                            <TableCell>{req.declaredClassBand}</TableCell>
                            <TableCell>
                              {format(new Date(req.absentDate), "yyyy/M/d", { locale: ja })}
                            </TableCell>
                            <TableCell className="text-sm">{req.toSlotId}</TableCell>
                            <TableCell>
                              {format(new Date(req.toSlotStartDateTime), "M/d(E) HH:mm", { locale: ja })}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(req.createdAt), "M/d HH:mm", { locale: ja })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="waiting" className="mt-6">
            {loadingWaiting && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {!loadingWaiting && waitingData && waitingData.length === 0 && (
              <Card className="border-2">
                <CardContent className="p-12 text-center">
                  <ClockIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">待ちリストはありません</p>
                </CardContent>
              </Card>
            )}

            {!loadingWaiting && waitingData && waitingData.length > 0 && (
              <div className="space-y-6">
                {waitingData.map((item) => (
                  <Card key={item.slotId} className="border-2" data-testid={`card-waiting-${item.slotId}`}>
                    <CardHeader className="p-6 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg mb-2">
                            {item.slot.courseLabel} - {item.slot.classBand}
                          </CardTitle>
                          <p className="text-base text-muted-foreground">
                            {format(new Date(item.slot.lessonStartDateTime), "yyyy年M月d日(E) HH:mm", { locale: ja })}
                          </p>
                        </div>
                        <Badge className="text-sm px-3 py-1">
                          待ち {item.requests.length} 名
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                        {editingSlot === item.slotId ? (
                          <>
                            <div>
                              <Label className="text-xs mb-1 block">振替受入枠数</Label>
                              <Input
                                type="number"
                                value={capacityValues[item.slotId]?.capacityMakeupAllowed || 0}
                                onChange={(e) =>
                                  setCapacityValues({
                                    ...capacityValues,
                                    [item.slotId]: {
                                      ...capacityValues[item.slotId],
                                      capacityMakeupAllowed: e.target.value,
                                    },
                                  })
                                }
                                className="h-10"
                              />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">使用済み枠数</Label>
                              <Input
                                type="number"
                                value={capacityValues[item.slotId]?.capacityMakeupUsed || 0}
                                onChange={(e) =>
                                  setCapacityValues({
                                    ...capacityValues,
                                    [item.slotId]: {
                                      ...capacityValues[item.slotId],
                                      capacityMakeupUsed: e.target.value,
                                    },
                                  })
                                }
                                className="h-10"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <Button
                                onClick={() => handleSaveCapacity(item.slotId)}
                                size="sm"
                                data-testid={`button-save-${item.slotId}`}
                              >
                                保存
                              </Button>
                              <Button
                                onClick={() => setEditingSlot(null)}
                                size="sm"
                                variant="outline"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">振替受入枠数</p>
                              <p className="text-base font-semibold">{item.slot.capacityMakeupAllowed}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">使用済み枠数</p>
                              <p className="text-base font-semibold">{item.slot.capacityMakeupUsed}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">残り枠数</p>
                              <p className="text-base font-semibold">
                                {item.slot.capacityMakeupAllowed - item.slot.capacityMakeupUsed}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {editingSlot !== item.slotId && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditSlot(item.slotId, item.slot)}
                            variant="outline"
                            size="sm"
                            data-testid={`button-edit-${item.slotId}`}
                          >
                            容量を編集
                          </Button>
                          <Button
                            onClick={() => handleCloseWaitlist(item.slotId)}
                            variant="outline"
                            size="sm"
                            data-testid={`button-close-${item.slotId}`}
                          >
                            1時間前クローズ
                          </Button>
                        </div>
                      )}

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3">待ちリスト（順番順）</h4>
                        <div className="space-y-2">
                          {item.requests.map((req, index) => (
                            <div
                              key={req.id}
                              className="flex items-center justify-between p-3 bg-card border rounded-lg"
                              data-testid={`row-waiting-request-${req.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-xs">
                                  {index + 1}番目
                                </Badge>
                                <div>
                                  <p className="font-medium">{req.childName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {req.contactEmail}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(req.createdAt), "M/d HH:mm", { locale: ja })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="slots" className="mt-6">
            <Card className="border-2">
              <CardHeader className="p-6 flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-xl">振替枠管理</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    コース設定と振替可能枠の管理
                  </p>
                </div>
                <div className="flex gap-2">
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
                  <Button
                    onClick={() => {
                      setEditingSlotData(null);
                      setShowSlotDialog(true);
                    }}
                    data-testid="button-create-slot"
                    size="default"
                    className="font-semibold"
                  >
                    新しい枠を作成
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {loadingSlots && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}

                {!loadingSlots && allSlots && allSlots.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">まだ枠が作成されていません</p>
                  </div>
                )}

                {!loadingSlots && allSlots && allSlots.length > 0 && viewMode === "calendar" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="rounded-md border"
                        modifiers={{
                          hasSlots: allSlots.map(slot => new Date(slot.date)),
                          holiday: holidays?.map(h => new Date(h.date)) || [],
                        }}
                        modifiersStyles={{
                          hasSlots: { 
                            fontWeight: 'bold',
                            backgroundColor: 'hsl(var(--primary) / 0.1)',
                          },
                          holiday: {
                            color: 'hsl(var(--destructive))',
                            textDecoration: 'line-through',
                          },
                        }}
                      />
                    </div>
                    <div className="space-y-4">
                      {selectedDate && (() => {
                        const selectedYear = selectedDate.getFullYear();
                        const selectedMonth = selectedDate.getMonth();
                        const selectedDay = selectedDate.getDate();
                        
                        const daySlots = allSlots.filter(slot => {
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
                                  <div
                                    key={slot.id}
                                    className="border-2 rounded-lg p-4 hover:bg-muted/30 transition-colors"
                                    data-testid={`row-slot-${slot.id}`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <p className="font-semibold text-lg">{slot.startTime}</p>
                                          <Badge variant="outline">{slot.classBand}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{slot.courseLabel}</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                          <div>
                                            <span className="text-muted-foreground">受入枠: </span>
                                            <span className="font-semibold">{slot.capacityMakeupAllowed}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">使用済み: </span>
                                            <span className="font-semibold">{slot.capacityMakeupUsed}</span>
                                          </div>
                                        </div>
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">残り枠数: </span>
                                          <span className="text-lg font-bold text-primary">
                                            {slot.capacityMakeupAllowed - slot.capacityMakeupUsed}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <Button
                                          onClick={() => {
                                            setEditingSlotData(slot);
                                            setShowSlotDialog(true);
                                          }}
                                          variant="outline"
                                          size="sm"
                                          data-testid={`button-edit-slot-${slot.id}`}
                                        >
                                          編集
                                        </Button>
                                        <Button
                                          onClick={async () => {
                                            const response = await fetch(`/api/admin/slot-requests-count?slotId=${slot.id}`);
                                            const data = await response.json();
                                            const requestsCount = data.count || 0;
                                            
                                            let message = `${slot.courseLabel}の枠を削除しますか？`;
                                            if (requestsCount > 0) {
                                              message = `${slot.courseLabel}の枠を削除しますか？\n\n※この枠には${requestsCount}件の申し込みがあります。削除すると申し込みも全て削除されます。`;
                                            }
                                            
                                            if (confirm(message)) {
                                              deleteSlotMutation.mutate(slot.id);
                                            }
                                          }}
                                          variant="outline"
                                          size="sm"
                                          data-testid={`button-delete-slot-${slot.id}`}
                                        >
                                          削除
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {!loadingSlots && allSlots && allSlots.length > 0 && viewMode === "list" && (
                  <div className="space-y-6">
                    {(() => {
                      // 日付でグループ化
                      const slotsByDate = allSlots.reduce((acc, slot) => {
                        const dateKey = new Date(slot.date).toISOString().split('T')[0];
                        if (!acc[dateKey]) {
                          acc[dateKey] = [];
                        }
                        acc[dateKey].push(slot);
                        return acc;
                      }, {} as Record<string, ClassSlot[]>);

                      // 日付順にソート
                      const sortedDates = Object.keys(slotsByDate).sort();

                      return sortedDates.map((dateKey) => {
                        const slots = slotsByDate[dateKey];
                        const date = new Date(dateKey);
                        
                        return (
                          <div key={dateKey} className="border-2 rounded-lg overflow-hidden">
                            <div className="bg-muted/50 px-6 py-4 border-b">
                              <h3 className="text-lg font-bold">
                                {format(date, "yyyy年M月d日(E)", { locale: ja })}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {slots.length}件の枠
                              </p>
                            </div>
                            <div className="divide-y">
                              {slots
                                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                .map((slot) => (
                                  <div
                                    key={slot.id}
                                    className="p-4 hover:bg-muted/30 transition-colors"
                                    data-testid={`row-slot-${slot.id}`}
                                  >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">時刻・コース</p>
                                          <p className="font-semibold">{slot.startTime}</p>
                                          <p className="text-sm text-muted-foreground">{slot.courseLabel}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">クラス帯</p>
                                          <Badge variant="outline" className="text-sm">
                                            {slot.classBand}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">受入枠</p>
                                          <p className="font-semibold">
                                            {slot.capacityMakeupAllowed} 枠
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            使用済み: {slot.capacityMakeupUsed}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">残り枠数</p>
                                          <p className="text-lg font-bold text-primary">
                                            {slot.capacityMakeupAllowed - slot.capacityMakeupUsed}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={() => {
                                            setEditingSlotData(slot);
                                            setShowSlotDialog(true);
                                          }}
                                          variant="outline"
                                          size="sm"
                                          data-testid={`button-edit-slot-${slot.id}`}
                                        >
                                          編集
                                        </Button>
                                        <Button
                                          onClick={async () => {
                                            // 申し込み件数を確認
                                            const response = await fetch(`/api/admin/slot-requests-count?slotId=${slot.id}`);
                                            const data = await response.json();
                                            const requestsCount = data.count || 0;
                                            
                                            let message = `${slot.courseLabel}の枠を削除しますか？`;
                                            if (requestsCount > 0) {
                                              message = `${slot.courseLabel}の枠を削除しますか？\n\n※この枠には${requestsCount}件の申し込みがあります。削除すると申し込みも全て削除されます。`;
                                            }
                                            
                                            if (confirm(message)) {
                                              deleteSlotMutation.mutate(slot.id);
                                            }
                                          }}
                                          variant="outline"
                                          size="sm"
                                          data-testid={`button-delete-slot-${slot.id}`}
                                        >
                                          削除
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 mt-6">
              <CardHeader className="p-6 flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-xl">休館日管理</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    スクールの休館日を登録
                  </p>
                </div>
                <Button
                  onClick={() => setShowHolidayDialog(true)}
                  data-testid="button-create-holiday"
                  size="default"
                  className="font-semibold"
                >
                  休館日を登録
                </Button>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {loadingHolidays && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}

                {!loadingHolidays && holidays && holidays.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">休館日が登録されていません</p>
                  </div>
                )}

                {!loadingHolidays && holidays && holidays.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {holidays.map((holiday) => (
                      <Card key={holiday.id} className="border" data-testid={`card-holiday-${holiday.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-lg font-semibold">
                                {format(new Date(holiday.date), "yyyy年M月d日(E)", { locale: ja })}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">{holiday.name}</p>
                            </div>
                            <Button
                              onClick={() => {
                                if (confirm(`${holiday.name}を削除しますか？`)) {
                                  deleteHolidayMutation.mutate(holiday.id);
                                }
                              }}
                              variant="outline"
                              size="sm"
                              data-testid={`button-delete-holiday-${holiday.id}`}
                            >
                              削除
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {showSlotDialog && (
        <SlotDialog
          slot={editingSlotData}
          open={showSlotDialog}
          onOpenChange={(open) => {
            setShowSlotDialog(open);
            if (!open) setEditingSlotData(null);
          }}
          onSave={(data) => {
            if (editingSlotData) {
              updateSlotMutation.mutate({ ...data, id: editingSlotData.id });
            } else {
              createSlotMutation.mutate(data);
            }
          }}
        />
      )}

      {showHolidayDialog && (
        <HolidayDialog
          open={showHolidayDialog}
          onOpenChange={setShowHolidayDialog}
          onSave={(data) => createHolidayMutation.mutate(data)}
        />
      )}

      <Link href="/">
        <Button
          data-testid="link-parent"
          className="fixed bottom-6 right-6 h-14 px-6 text-base font-semibold shadow-lg"
          variant="outline"
        >
          保護者向け画面
        </Button>
      </Link>
    </div>
  );
}

type SlotDialogProps = {
  slot: ClassSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
};

function SlotDialog({ slot, open, onOpenChange, onSave }: SlotDialogProps) {
  const [classBandCapacities, setClassBandCapacities] = useState<Record<string, any>>({});

  const form = useForm({
    resolver: zodResolver(
      z.object({
        date: z.string().min(1, "日付を選択してください"),
        startTime: z.string().min(1, "開始時刻を入力してください"),
        courseLabel: z.string().min(1, "コース名を入力してください"),
        classBands: z.array(z.enum(["初級", "中級", "上級"])).min(1, "少なくとも1つのクラス帯を選択してください"),
        isRecurring: z.boolean().optional(),
        recurringWeeks: z.number().min(1).max(52).optional(),
        applyToFuture: z.boolean().optional(),
      })
    ),
    defaultValues: slot
      ? {
          date: new Date(slot.date).toISOString().split("T")[0],
          startTime: slot.startTime,
          courseLabel: slot.courseLabel,
          classBands: [slot.classBand],
          isRecurring: false,
          recurringWeeks: 12,
          applyToFuture: false,
        }
      : {
          date: "",
          startTime: "10:00",
          courseLabel: "",
          classBands: [],
          isRecurring: false,
          recurringWeeks: 12,
          applyToFuture: false,
        },
  });

  // 編集時の初期値設定
  useState(() => {
    if (slot) {
      setClassBandCapacities({
        [slot.classBand]: {
          capacityLimit: slot.capacityLimit,
          capacityCurrent: slot.capacityCurrent,
          capacityMakeupAllowed: slot.capacityMakeupAllowed,
        }
      });
    }
  });

  const selectedBands = form.watch("classBands") || [];

  // クラス帯が選択されたときにデフォルト値を設定
  const handleClassBandChange = (band: string, checked: boolean) => {
    if (checked && !classBandCapacities[band]) {
      const defaultLimit = 10;
      const defaultCurrent = 0;
      setClassBandCapacities({
        ...classBandCapacities,
        [band]: {
          capacityLimit: defaultLimit,
          capacityCurrent: defaultCurrent,
          capacityMakeupAllowed: defaultLimit - defaultCurrent,
        }
      });
    }
  };

  const handleSubmit = (data: any) => {
    // クラス帯ごとの設定を含めて送信
    onSave({
      ...data,
      classBandCapacities,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {slot ? "枠を編集" : "新しい枠を作成"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>日付</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-slot-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始時刻</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" data-testid="input-slot-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="courseLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>コース名</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例：月曜10時コース"
                      data-testid="input-slot-courselabel"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="classBands"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>クラス帯（複数選択可）</FormLabel>
                  <div className="space-y-2">
                    {["初級", "中級", "上級"].map((band) => (
                      <div key={band} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`band-${band}`}
                          checked={field.value?.includes(band as any)}
                          onChange={(e) => {
                            const currentValue = field.value || [];
                            if (e.target.checked) {
                              field.onChange([...currentValue, band]);
                              handleClassBandChange(band, true);
                            } else {
                              field.onChange(currentValue.filter((v: string) => v !== band));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid={`checkbox-band-${band}`}
                        />
                        <label htmlFor={`band-${band}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {band}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedBands.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">各クラス帯の定員設定</h3>
                {selectedBands.map((band) => (
                  <div key={band} className="border rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-sm">{band}</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs mb-1 block">定員</Label>
                        <Input
                          type="number"
                          value={classBandCapacities[band]?.capacityLimit ?? 10}
                          onChange={(e) => {
                            const newLimit = parseInt(e.target.value) || 0;
                            const current = classBandCapacities[band]?.capacityCurrent ?? 0;
                            setClassBandCapacities({
                              ...classBandCapacities,
                              [band]: {
                                ...classBandCapacities[band],
                                capacityLimit: newLimit,
                                capacityMakeupAllowed: Math.max(0, newLimit - current),
                              },
                            });
                          }}
                          data-testid={`input-${band}-capacitylimit`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">現在の参加者数</Label>
                        <Input
                          type="number"
                          value={classBandCapacities[band]?.capacityCurrent ?? 0}
                          onChange={(e) => {
                            const newCurrent = parseInt(e.target.value) || 0;
                            const limit = classBandCapacities[band]?.capacityLimit ?? 10;
                            setClassBandCapacities({
                              ...classBandCapacities,
                              [band]: {
                                ...classBandCapacities[band],
                                capacityCurrent: newCurrent,
                                capacityMakeupAllowed: Math.max(0, limit - newCurrent),
                              },
                            });
                          }}
                          data-testid={`input-${band}-capacitycurrent`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">振替受入枠数</Label>
                        <Input
                          type="number"
                          value={classBandCapacities[band]?.capacityMakeupAllowed ?? 2}
                          onChange={(e) =>
                            setClassBandCapacities({
                              ...classBandCapacities,
                              [band]: {
                                ...classBandCapacities[band],
                                capacityMakeupAllowed: parseInt(e.target.value) || 0,
                              },
                            })
                          }
                          data-testid={`input-${band}-capacitymakeupallowed`}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!slot && (
              <div className="border-t pt-4 mt-2">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1"
                          data-testid="checkbox-recurring"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-semibold">
                          毎週繰り返し作成
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          この枠を毎週同じ曜日・時間に自動作成します（休館日は除く）
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("isRecurring") && (
                  <FormField
                    control={form.control}
                    name="recurringWeeks"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>作成する週数</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            max="52"
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-recurring-weeks"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {field.value}週間分の枠を作成します
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {slot && (
              <div className="border-t pt-4 mt-2">
                <FormField
                  control={form.control}
                  name="applyToFuture"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1"
                          data-testid="checkbox-apply-to-future"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-semibold">
                          この日以降すべての同一コースに適用
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          同じ曜日・時間・クラス帯のコースすべてに人数設定を適用します
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-slot"
              >
                キャンセル
              </Button>
              <Button type="submit" data-testid="button-save-slot">
                {slot ? "更新" : "作成"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type HolidayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
};

function HolidayDialog({ open, onOpenChange, onSave }: HolidayDialogProps) {
  const form = useForm({
    resolver: zodResolver(
      z.object({
        date: z.string().min(1, "日付を選択してください"),
        name: z.string().min(1, "休館日名を入力してください"),
      })
    ),
    defaultValues: {
      date: "",
      name: "",
    },
  });

  const handleSubmit = (data: any) => {
    onSave(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">休館日を登録</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>日付</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-holiday-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>休館日名</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例：年末年始休館"
                      data-testid="input-holiday-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
                data-testid="button-cancel-holiday"
              >
                キャンセル
              </Button>
              <Button type="submit" data-testid="button-save-holiday">
                登録
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
