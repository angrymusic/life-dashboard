import Image from "next/image";
import type { ChangeEvent } from "react";
import { useCallback, useRef } from "react";
import { Upload, X } from "lucide-react";
import { usePhotoWidget } from "@/feature/widgets/Photo/hooks/usePhotoWidget";
import { WidgetCard } from "@/feature/widgets/shared/components/WidgetCard";
import { WidgetDeleteDialog } from "@/feature/widgets/shared/components/WidgetDeleteDialog";
import { useWidgetActionMenu } from "@/feature/widgets/shared/hooks/useWidgetActionMenu";
import { ActionMenuButton } from "@/shared/ui/buttons/DropdownButton";
import { Button } from "@/shared/ui/button";
import type { Id } from "@/shared/db/schema";

type PhotoWidgetProps = {
  widgetId: Id;
  canEdit?: boolean;
};

export function PhotoWidget({ widgetId, canEdit = true }: PhotoWidgetProps) {
  const { photoUrl, hasPhoto, replacePhoto, clearPhoto } =
    usePhotoWidget(widgetId);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = useCallback(() => {
    if (!canEdit) return;
    inputRef.current?.click();
  }, [canEdit]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void replacePhoto(file);
      event.currentTarget.value = "";
    },
    [replacePhoto]
  );

  const uploadItem = {
    text: hasPhoto ? "사진 변경" : "사진 업로드",
    icon: <Upload className="size-4" />,
    onClick: openFileDialog,
  };

  const extraItems = hasPhoto
    ? [
        uploadItem,
        {
          text: "사진 비우기",
          icon: <X className="size-4" />,
          onClick: () => void clearPhoto(),
        },
      ]
    : [uploadItem];

  const {
    actions,
    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      close: closeDeleteDialog,
      confirm: handleDelete,
    },
  } = useWidgetActionMenu({
    widgetId,
    canEdit,
    deleteLabel: "위젯 삭제",
    extraItems,
  });

  const showActions = canEdit && actions.length > 0;

  return (
    <WidgetCard className="p-0">
      <div className="relative h-full w-full">
        {showActions ? (
          <div className="absolute right-2 top-2 z-10">
            <ActionMenuButton
              items={actions}
              triggerAriaLabel="사진 위젯 메뉴"
            />
          </div>
        ) : null}

        {photoUrl ? (
          <div className="flex h-full w-full items-center justify-center overflow-hidden">
            <Image
              src={photoUrl}
              alt="업로드된 사진"
              width={1}
              height={1}
              unoptimized
              className="block h-full w-auto max-w-none shrink-0"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
            <Upload className="size-6" />
            <div className="text-sm font-medium text-gray-500">
              사진이 없습니다
            </div>
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openFileDialog}
              >
                사진 업로드
              </Button>
            ) : (
              <span className="text-xs opacity-70">읽기 전용</span>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {canEdit ? (
          <WidgetDeleteDialog
            open={isDeleteDialogOpen}
            widgetName="사진"
            onClose={closeDeleteDialog}
            onConfirm={handleDelete}
          />
        ) : null}
      </div>
    </WidgetCard>
  );
}
