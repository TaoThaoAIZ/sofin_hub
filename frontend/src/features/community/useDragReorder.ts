import { useEffect, useMemo, useState, type DragEvent } from 'react';

/**
 * Kéo-thả đổi thứ tự một danh sách (HTML5 DnD, không cần thư viện). Chỉ kéo được khi nhấn vào tay nắm (`handleProps`),
 * để bấm vào link/nút trong dòng vẫn bình thường. Hiển thị thứ tự mới ngay (lạc quan), `onReorder(ids, revert)` gửi danh sách id mới lên server (gọi `revert` khi lỗi);
 * khi dữ liệu server về (items đổi) hoặc lỗi thì bỏ thứ tự tạm.
 */
export function useDragReorder<T extends { id: string }>(items: T[] | undefined, onReorder: (ids: string[], revert: () => void) => void) {
  const [armed, setArmed] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [local, setLocal] = useState<string[] | null>(null);

  useEffect(() => setLocal(null), [items]);

  const ordered = useMemo(() => {
    if (!items || !local) return items;
    const byId = new Map(items.map((i) => [i.id, i]));
    const list = local.map((id) => byId.get(id)).filter((x): x is T => !!x);
    return list.length === items.length ? list : items;
  }, [items, local]);

  const reset = () => {
    setArmed(null);
    setDragId(null);
    setOverId(null);
  };

  const drop = (targetId: string) => {
    if (!ordered || !dragId || dragId === targetId) return reset();
    const ids = ordered.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return reset();
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    setLocal(ids);
    onReorder(ids, () => setLocal(null));
    reset();
  };

  return {
    items: ordered,
    handleProps: (id: string) => ({
      onPointerDown: () => setArmed(id),
      onPointerUp: () => setArmed(null),
      style: { cursor: 'grab', touchAction: 'none' } as const,
    }),
    rowProps: (id: string) => ({
      draggable: armed === id,
      onDragStart: (e: DragEvent) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      },
      onDragOver: (e: DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (overId !== id) setOverId(id);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        drop(id);
      },
      onDragEnd: reset,
      'data-dragging': dragId === id ? '1' : undefined,
      'data-over': overId === id && dragId !== id ? '1' : undefined,
    }),
    /** Class hiển thị: dòng đang kéo mờ đi, dòng đích có vạch cam phía trên. */
    rowClass: (id: string) => `${dragId === id ? 'opacity-40' : ''} ${overId === id && dragId && dragId !== id ? 'shadow-[0_-2px_0_0_#ff570a]' : ''}`,
  };
}
