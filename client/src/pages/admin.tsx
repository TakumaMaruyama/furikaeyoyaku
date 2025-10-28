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
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react";
import { Link } from "wouter";

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

  const { data: confirmedRequests, isLoading: loadingConfirmed } = useQuery<Request[]>({
    queryKey: ["/api/admin/confirmed"],
  });

  const { data: waitingData, isLoading: loadingWaiting } = useQuery<WaitingRequest[]>({
    queryKey: ["/api/admin/waiting"],
  });

  const { data: allSlots, isLoading: loadingSlots } = useQuery<ClassSlot[]>({
    queryKey: ["/api/admin/slots"],
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
    onSuccess: () => {
      toast({
        title: "作成完了",
        description: "新しい枠を作成しました。",
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

                {!loadingSlots && allSlots && allSlots.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">コース名</TableHead>
                          <TableHead className="font-semibold">クラス</TableHead>
                          <TableHead className="font-semibold">日時</TableHead>
                          <TableHead className="font-semibold">受入枠数</TableHead>
                          <TableHead className="font-semibold">使用済み</TableHead>
                          <TableHead className="font-semibold">残り</TableHead>
                          <TableHead className="font-semibold">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSlots.map((slot) => (
                          <TableRow key={slot.id} data-testid={`row-slot-${slot.id}`}>
                            <TableCell className="font-medium">{slot.courseLabel}</TableCell>
                            <TableCell>{slot.classBand}</TableCell>
                            <TableCell>
                              {format(new Date(slot.lessonStartDateTime), "yyyy/M/d(E) HH:mm", { locale: ja })}
                            </TableCell>
                            <TableCell>{slot.capacityMakeupAllowed}</TableCell>
                            <TableCell>{slot.capacityMakeupUsed}</TableCell>
                            <TableCell className="font-semibold">
                              {slot.capacityMakeupAllowed - slot.capacityMakeupUsed}
                            </TableCell>
                            <TableCell>
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
                                  onClick={() => {
                                    if (confirm(`${slot.courseLabel}の枠を削除しますか？`)) {
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
  const form = useForm({
    resolver: zodResolver(
      z.object({
        date: z.string().min(1, "日付を選択してください"),
        startTime: z.string().min(1, "開始時刻を入力してください"),
        courseLabel: z.string().min(1, "コース名を入力してください"),
        classBand: z.enum(["初級", "中級", "上級"]),
        capacityLimit: z.number().min(0, "0以上の数値を入力してください"),
        capacityCurrent: z.number().min(0, "0以上の数値を入力してください"),
        capacityMakeupAllowed: z.number().min(0, "0以上の数値を入力してください"),
      })
    ),
    defaultValues: slot
      ? {
          date: new Date(slot.date).toISOString().split("T")[0],
          startTime: slot.startTime,
          courseLabel: slot.courseLabel,
          classBand: slot.classBand,
          capacityLimit: slot.capacityLimit,
          capacityCurrent: slot.capacityCurrent,
          capacityMakeupAllowed: slot.capacityMakeupAllowed,
        }
      : {
          date: "",
          startTime: "10:00",
          courseLabel: "",
          classBand: "初級" as const,
          capacityLimit: 10,
          capacityCurrent: 0,
          capacityMakeupAllowed: 2,
        },
  });

  const handleSubmit = (data: any) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
              name="classBand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>クラス帯</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-slot-classband">
                        <SelectValue />
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="capacityLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>定員</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-slot-capacitylimit"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacityCurrent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>現在の参加者数</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-slot-capacitycurrent"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacityMakeupAllowed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>振替受入枠数</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-slot-capacitymakeupallowed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
