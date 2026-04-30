"use client";

import { memo, type FC } from "react";
import type {
  TextMessagePartComponent,
  Unstable_MentionDirective,
} from "@assistant-ui/react";
import { Badge } from "./badge";

type IconComponent = FC<{ className?: string }>;
type DirectiveFormatter = Unstable_MentionDirective["formatter"];
type DirectiveSegment = ReturnType<DirectiveFormatter["parse"]>[number];

export type CreateDirectiveTextOptions = {
  /** Maps a directive `type` to an icon component. */
  iconMap?: Record<string, IconComponent>;
  /** Icon rendered when `iconMap` has no entry for the segment type. */
  fallbackIcon?: IconComponent;
};

const DIRECTIVE_RE = /:([\w-]{1,64})\[([^\]\n]{1,1024})\](?:\{name=([^}\n]{1,1024})\})?/gu;

export const defaultDirectiveFormatter: DirectiveFormatter = {
  serialize(item) {
    const attrs = item.id !== item.label ? `{name=${item.id}}` : "";
    return `:${item.type}[${item.label}]${attrs}`;
  },
  parse(text) {
    const segments: DirectiveSegment[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(DIRECTIVE_RE)) {
      const matchIndex = match.index;
      const directiveType = match[1];
      const label = match[2];

      if (matchIndex === undefined || !directiveType || !label) {
        continue;
      }

      if (matchIndex > lastIndex) {
        segments.push({
          kind: "text",
          text: text.slice(lastIndex, matchIndex),
        });
      }

      segments.push({
        kind: "mention",
        type: directiveType,
        label,
        id: match[3] ?? label,
      });
      lastIndex = matchIndex + match[0]!.length;
    }

    if (lastIndex < text.length) {
      segments.push({ kind: "text", text: text.slice(lastIndex) });
    }

    return segments;
  },
};

/** Creates a `Text` message part component that parses directive syntax and renders inline chips. */
export function createDirectiveText(
  formatter: DirectiveFormatter,
  options?: CreateDirectiveTextOptions,
): TextMessagePartComponent {
  const iconMap = options?.iconMap;
  const fallbackIcon = options?.fallbackIcon;

  const Component: TextMessagePartComponent = ({ text }) => {
    const segments = formatter.parse(text);

    if (segments.length === 1 && segments[0]!.kind === "text") {
      return <>{text}</>;
    }

    return (
      <>
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return (
              <span key={i} className="whitespace-pre-wrap">
                {seg.text}
              </span>
            );
          }

          const Icon = iconMap?.[seg.type] ?? fallbackIcon;
          return (
            <Badge
              key={i}
              variant="info"
              size="sm"
              data-slot="directive-text-chip"
              data-directive-type={seg.type}
              data-directive-id={seg.id}
              aria-label={`${seg.type}: ${seg.label}`}
              className="aui-directive-chip items-baseline text-[13px] leading-none [&_svg]:self-center"
            >
              {Icon && <Icon />}
              {seg.label}
            </Badge>
          );
        })}
      </>
    );
  };
  Component.displayName = "DirectiveText";
  return Component;
}

const DirectiveTextImpl = createDirectiveText(defaultDirectiveFormatter);

/** `Text` message part component that renders directive syntax as inline chips. */
export const DirectiveText: TextMessagePartComponent = memo(DirectiveTextImpl);
