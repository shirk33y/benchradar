import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type PreviewState = {
  photos: string[];
  index: number;
};

export function useFullImagePreview() {
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [previewDragOffset, setPreviewDragOffset] = useState(0);
  const [previewSwipeOffset, setPreviewSwipeOffset] = useState(0);

  const previewGestureRef = useRef<{
    startX: number;
    startY: number;
    direction: "horizontal" | "vertical" | null;
  } | null>(null);

  const close = () => {
    setPreviewState(null);
    setPreviewDragOffset(0);
    setPreviewSwipeOffset(0);
  };

  const showRelative = (delta: number) => {
    setPreviewState((current) => {
      if (!current || current.photos.length === 0) {
        return current;
      }
      const nextIndex =
        (current.index + delta + current.photos.length) % current.photos.length;
      return { ...current, index: nextIndex };
    });
  };

  const open = (photos: string[], startIndex = 0) => {
    if (!photos || photos.length === 0) return;
    const clampedIndex = Math.min(Math.max(startIndex, 0), photos.length - 1);
    setPreviewState({ photos, index: clampedIndex });
    setPreviewDragOffset(0);
    setPreviewSwipeOffset(0);
  };

  const resetPreviewGesture = (
    target?: EventTarget & Element,
    pointerId?: number
  ) => {
    if (
      target &&
      typeof (target as any).releasePointerCapture === "function" &&
      pointerId !== undefined
    ) {
      try {
        (target as any).releasePointerCapture(pointerId);
      } catch {
        return;
      }
    }
    previewGestureRef.current = null;
    setPreviewDragOffset(0);
    setPreviewSwipeOffset(0);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewState) return;
    previewGestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      direction: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewState) return;
    const gesture = previewGestureRef.current;
    if (!gesture) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.direction) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        return;
      }
      gesture.direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      previewGestureRef.current = gesture;
    }

    if (gesture.direction === "horizontal") {
      event.preventDefault();
      setPreviewSwipeOffset(dx);
    } else {
      event.preventDefault();
      setPreviewDragOffset(Math.max(dy, 0));
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewState) {
      resetPreviewGesture(event.currentTarget, event.pointerId);
      return;
    }
    const gesture = previewGestureRef.current;
    if (!gesture) {
      resetPreviewGesture(event.currentTarget, event.pointerId);
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.direction === "horizontal" && Math.abs(dx) > 80) {
      showRelative(dx > 0 ? -1 : 1);
    } else if (gesture.direction === "vertical" && dy > 120) {
      close();
    }

    resetPreviewGesture(event.currentTarget, event.pointerId);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    resetPreviewGesture(event.currentTarget, event.pointerId);
  };

  useEffect(() => {
    if (!previewState) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowRight") {
        showRelative(1);
      } else if (event.key === "ArrowLeft") {
        showRelative(-1);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [previewState]);

  return {
    previewState,
    previewDragOffset,
    previewSwipeOffset,
    open,
    close,
    showRelative,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
