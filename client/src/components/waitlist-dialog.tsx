import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SearchSlotsRequest, SlotSearchResult } from "@shared/schema";
import { MailIcon } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("正しいメールアドレスを入力してください"),
});

type EmailForm = z.infer<typeof emailSchema>;

interface WaitlistDialogProps {
  slot: SlotSearchResult;
  searchParams: SearchSlotsRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WaitlistDialog({
  slot,
  searchParams,
  open,
  onOpenChange,
  onSuccess,
}: WaitlistDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: EmailForm) => {
    setIsSubmitting(true);
    try {
      const result = await apiRequest("POST", "/api/waitlist", {
        childName: searchParams.childName,
        declaredClassBand: searchParams.declaredClassBand,
        absentDateISO: searchParams.absentDateISO,
        toSlotId: slot.slotId,
        contactEmail: data.email,
      });

      toast({
        title: "順番待ち登録完了",
        description: (result as any).message || "順番待ちとして受け付けました。",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/search-slots"] });
      form.reset();
      onSuccess();
    } catch (error: any) {
      toast({
        title: "登録エラー",
        description: error.message || "登録に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">順番待ち登録</DialogTitle>
          <DialogDescription className="text-base">
            空きが出次第、自動的に振替予約が確定されます。<br />
            確定通知をお送りするメールアドレスを入力してください。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-semibold mb-1">{slot.courseLabel}</p>
            <p className="text-sm text-muted-foreground">
              {slot.date} {slot.startTime} - {slot.classBand}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              現在 {slot.waitlistCount} 名待ち
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" className="font-semibold mb-2 block">
                メールアドレス
              </Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  {...form.register("email")}
                  placeholder="example@email.com"
                  className="h-12 pl-10 border-2"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="border-2"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                data-testid="button-submit-waitlist"
                disabled={isSubmitting}
              >
                {isSubmitting ? "登録中..." : "順番待ち登録"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
