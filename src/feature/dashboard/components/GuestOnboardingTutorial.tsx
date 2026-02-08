"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

const STORAGE_KEY = "lifedashboard.guestOnboarding.v1.completed";
const HIGHLIGHT_PADDING = 8;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 196;
const VIEWPORT_MARGIN = 16;
const GAP = 12;

type StepPlacement = "bottom-start" | "bottom-end" | "top-end";

type TutorialStep = {
  targetId: string;
  title: string;
  description: string;
  placement: StepPlacement;
};

const STEPS: TutorialStep[] = [
  {
    targetId: "dashboard-manage",
    title: "대시보드 관리",
    description:
      "좌측 상단 버튼에서 대시보드를 만들고, 이름을 바꾸거나 삭제할 수 있어요.",
    placement: "bottom-start",
  },
  {
    targetId: "member-manage",
    title: "구성원 관리",
    description:
      "우측 상단 구성원 버튼에서 현재 대시보드의 구성원을 추가하고 관리할 수 있어요.",
    placement: "bottom-end",
  },
  {
    targetId: "account-manage",
    title: "계정 관리",
    description:
      "우측 상단 계정 버튼에서 로그인 상태 확인, 로그인/로그아웃, 로컬 데이터 관리를 할 수 있어요.",
    placement: "bottom-end",
  },
  {
    targetId: "add-widget",
    title: "위젯 추가",
    description: "우측 하단 + 버튼에서 원하는 위젯을 추가할 수 있어요.",
    placement: "top-end",
  },
];

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type Viewport = {
  width: number;
  height: number;
};

type GuestOnboardingTutorialProps = {
  enabled: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function GuestOnboardingTutorial({
  enabled,
}: GuestOnboardingTutorialProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });

  const currentStep = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isLastStep = stepIndex >= STEPS.length - 1;

  const completeTutorial = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!open || !currentStep) return;
    const target = document.querySelector<HTMLElement>(
      `[data-tour-target="${currentStep.targetId}"]`
    );
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    if (!target) {
      setTargetRect(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [currentStep, open]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!enabled) {
        setOpen(false);
        return;
      }
      const completed = localStorage.getItem(STORAGE_KEY) === "1";
      if (!completed) {
        setStepIndex(0);
        setOpen(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const handlePositionUpdate = () => updateTargetRect();
    const frame = window.requestAnimationFrame(handlePositionUpdate);
    window.addEventListener("resize", handlePositionUpdate);
    window.addEventListener("scroll", handlePositionUpdate, true);
    const timer = window.setInterval(handlePositionUpdate, 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handlePositionUpdate);
      window.removeEventListener("scroll", handlePositionUpdate, true);
      window.clearInterval(timer);
    };
  }, [open, updateTargetRect]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        completeTutorial();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completeTutorial, open]);

  const panelStyle = useMemo(() => {
    if (!targetRect || !viewport.width || !viewport.height || !currentStep) {
      return {
        top: VIEWPORT_MARGIN,
        left: VIEWPORT_MARGIN,
      };
    }

    const targetBottom = targetRect.top + targetRect.height;
    const targetRight = targetRect.left + targetRect.width;

    const nextTop =
      currentStep.placement === "top-end"
        ? targetRect.top - PANEL_HEIGHT - GAP
        : targetBottom + GAP;
    const nextLeft =
      currentStep.placement === "bottom-start"
        ? targetRect.left
        : targetRight - PANEL_WIDTH;

    return {
      top: clamp(
        nextTop,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewport.height - PANEL_HEIGHT - VIEWPORT_MARGIN)
      ),
      left: clamp(
        nextLeft,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewport.width - PANEL_WIDTH - VIEWPORT_MARGIN)
      ),
    };
  }, [currentStep, targetRect, viewport.height, viewport.width]);

  if (!open || !currentStep) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/55" />

      {targetRect ? (
        <div
          className="pointer-events-none fixed z-[61] rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)] transition-all duration-150"
          style={{
            top: targetRect.top - HIGHLIGHT_PADDING,
            left: targetRect.left - HIGHLIGHT_PADDING,
            width: targetRect.width + HIGHLIGHT_PADDING * 2,
            height: targetRect.height + HIGHLIGHT_PADDING * 2,
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="초기 사용 가이드"
        className={cn(
          "fixed z-[70] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/20 bg-card/95 p-4 text-card-foreground shadow-xl backdrop-blur-sm",
          !targetRect ? "top-4 left-4 right-4 mx-auto sm:w-80 sm:left-1/2 sm:-translate-x-1/2" : ""
        )}
        style={targetRect ? panelStyle : undefined}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-muted-foreground">
            시작 가이드 {stepIndex + 1}/{STEPS.length}
          </div>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            onClick={completeTutorial}
          >
            건너뛰기
          </button>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{currentStep.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={stepIndex === 0}
          >
            이전
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (isLastStep) {
                completeTutorial();
                return;
              }
              setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
            }}
          >
            {isLastStep ? "완료" : "다음"}
          </Button>
        </div>
      </div>
    </>
  );
}
