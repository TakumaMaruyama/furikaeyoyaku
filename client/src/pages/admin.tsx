import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react";

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
  capacityMakeupAllowed: number;
  capacityMakeupUsed: number;
  waitlistCount: number;
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

  const { data: confirmedRequests, isLoading: loadingConfirmed } = useQuery<Request[]>({
    queryKey: ["/api/admin/confirmed"],
  });

  const { data: waitingData, isLoading: loadingWaiting } = useQuery<WaitingRequest[]>({
    queryKey: ["/api/admin/waiting"],
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
          <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
            <TabsTrigger value="confirmed" data-testid="tab-confirmed" className="text-base">
              確定一覧
            </TabsTrigger>
            <TabsTrigger value="waiting" data-testid="tab-waiting" className="text-base">
              待ち一覧
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
        </Tabs>
      </main>
    </div>
  );
}
