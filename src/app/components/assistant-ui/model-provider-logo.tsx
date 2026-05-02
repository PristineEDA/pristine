"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  availableModelProviderLogoIds,
  modelProviderLogoManifest,
} from "./model-provider-logo-manifest.generated";

const logoIdOverrides = new Map<string, string>([
  ["fireworks-ai", "fireworks"],
  ["fireworks_ai", "fireworks"],
]);

const logoPathByProviderId = new Map<string, string>(
  modelProviderLogoManifest
    .filter((entry) => entry.hasLogo)
    .map((entry) => [entry.providerId, entry.path]),
);

const availableLogoIds = new Set<string>(availableModelProviderLogoIds);

export function normalizeProviderLogoId(providerId: string) {
  const baseProviderId = providerId.includes(".")
    ? providerId.split(".")[0] ?? providerId
    : providerId;
  const mappedProviderId = logoIdOverrides.get(baseProviderId) ?? baseProviderId;
  return mappedProviderId.replace(/\//g, "-").toLowerCase();
}

export function getLocalProviderLogoPath(providerId: string) {
  const manifestPath = logoPathByProviderId.get(providerId);

  if (manifestPath) {
    return manifestPath;
  }

  const logoId = normalizeProviderLogoId(providerId);
  return availableLogoIds.has(logoId) ? `/model-provider-logos/${logoId}.svg` : undefined;
}

export interface ModelProviderLogoProps {
  providerId: string;
  providerName?: string;
  size?: number;
  className?: string;
}

export function ModelProviderLogo({
  providerId,
  providerName,
  size = 16,
  className,
}: ModelProviderLogoProps) {
  const [failed, setFailed] = useState(false);
  const logoPath = useMemo(() => getLocalProviderLogoPath(providerId), [providerId]);
  const fallbackLabel = (providerName ?? providerId).trim().charAt(0).toUpperCase();
  const style = {
    "--model-provider-logo-size": `${size}px`,
  } as CSSProperties;

  return (
    <span
      data-slot="model-provider-logo"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-sm",
        "h-(--model-provider-logo-size) w-(--model-provider-logo-size)",
        className,
      )}
      style={style}
    >
      {logoPath && !failed ? (
        <img
          src={logoPath}
          alt={`${providerName ?? providerId} logo`}
          width={size}
          height={size}
          loading="lazy"
          className="size-full object-contain opacity-90 dark:brightness-0 dark:invert"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-label={`${providerName ?? providerId} logo fallback`}
          className="flex size-full items-center justify-center rounded-sm bg-muted text-[9px] font-medium text-muted-foreground"
        >
          {fallbackLabel || <Bot className="size-3" />}
        </span>
      )}
    </span>
  );
}
