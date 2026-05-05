"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { VariantProps } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useAssistantApi } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Input } from "@/app/components/ui/input";
import { selectTriggerVariants } from "@/app/components/assistant-ui/select";

export type ModelOption = {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type ModelProviderOption = {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  models: readonly ModelOption[];
};

type ModelSelection = {
  model: ModelOption;
  provider: ModelProviderOption;
};

type ModelSelectorContextValue = {
  providers: readonly ModelProviderOption[];
  selectedModelId: string;
  selection: ModelSelection | undefined;
  onValueChange: (value: string) => void;
};

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

function useModelSelectorContext() {
  const ctx = useContext(ModelSelectorContext);
  if (!ctx) {
    throw new Error(
      "ModelSelector sub-components must be used within ModelSelector.Root",
    );
  }
  return ctx;
}

function createFallbackProvider(models: readonly ModelOption[] | undefined) {
  return [
    {
      id: "models",
      name: "Models",
      models: models ?? [],
    },
  ] satisfies readonly ModelProviderOption[];
}

function normalizeProviders({
  models,
  providers,
}: {
  models?: readonly ModelOption[];
  providers?: readonly ModelProviderOption[];
}) {
  return providers ?? createFallbackProvider(models);
}

export function getFirstModelId(
  providers: readonly ModelProviderOption[],
): string {
  return providers.find((provider) => provider.models.length > 0)?.models[0]?.id ?? "";
}

export function findModelSelection(
  providers: readonly ModelProviderOption[],
  modelId: string | undefined,
): ModelSelection | undefined {
  if (!modelId) {
    return undefined;
  }

  for (const provider of providers) {
    const model = provider.models.find((item) => item.id === modelId);
    if (model) {
      return { model, provider };
    }
  }

  return undefined;
}

export function filterProvidersByQuery(
  providers: readonly ModelProviderOption[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return providers;
  }

  return providers.filter((provider) =>
    provider.name.toLowerCase().includes(normalizedQuery) ||
    provider.id.toLowerCase().includes(normalizedQuery),
  );
}

export type ModelSelectorRootProps = {
  providers?: readonly ModelProviderOption[];
  models?: readonly ModelOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
};

function ModelSelectorRoot({
  providers: providersProp,
  models,
  defaultValue,
  children,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  ...menuProps
}: ModelSelectorRootProps) {
  const providers = useMemo(
    () => normalizeProviders({ models, providers: providersProp }),
    [models, providersProp],
  );
  const fallbackValue = defaultValue ?? getFirstModelId(providers);
  const [internalValue, setInternalValue] = useState(fallbackValue);
  const selectedModelId = controlledValue ?? internalValue;
  const selection = useMemo(
    () => findModelSelection(providers, selectedModelId),
    [providers, selectedModelId],
  );

  useEffect(() => {
    if (controlledValue === undefined && !selectedModelId && fallbackValue) {
      setInternalValue(fallbackValue);
    }
  }, [controlledValue, fallbackValue, selectedModelId]);

  const handleValueChange = useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(nextValue);
      }

      controlledOnValueChange?.(nextValue);
    },
    [controlledOnValueChange, controlledValue],
  );

  const contextValue = useMemo<ModelSelectorContextValue>(
    () => ({
      providers,
      selectedModelId,
      selection,
      onValueChange: handleValueChange,
    }),
    [handleValueChange, providers, selectedModelId, selection],
  );

  return (
    <ModelSelectorContext.Provider value={contextValue}>
      <DropdownMenu {...menuProps}>{children}</DropdownMenu>
    </ModelSelectorContext.Provider>
  );
}

export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<
  typeof DropdownMenuTrigger
> &
  VariantProps<typeof selectTriggerVariants>;

function ModelSelectorTrigger({
  className,
  variant,
  size,
  children,
  ...props
}: ModelSelectorTriggerProps) {
  return (
    <DropdownMenuTrigger
      data-slot="model-selector-trigger"
      data-variant={variant ?? "outline"}
      data-size={size ?? "default"}
      className={cn(
        "aui-model-selector-trigger min-w-0",
        selectTriggerVariants({ variant, size }),
        className,
      )}
      {...props}
    >
      {children ?? <ModelSelectorValue />}
      <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
    </DropdownMenuTrigger>
  );
}

function ModelSelectorValue() {
  const { selection } = useModelSelectorContext();

  if (!selection) {
    return <span className="truncate text-muted-foreground">Select model</span>;
  }

  const { model } = selection;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate font-normal">{model.name}</span>
    </span>
  );
}

export type ModelSelectorContentProps = ComponentPropsWithoutRef<
  typeof DropdownMenuContent
>;

function ModelSelectorContent({
  className,
  children,
  align = "start",
  ...props
}: ModelSelectorContentProps) {
  const { providers } = useModelSelectorContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shouldRestoreSearchFocusRef = useRef(false);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const filteredProviders = useMemo(
    () => filterProvidersByQuery(providers, searchQuery),
    [providers, searchQuery],
  );
  const normalizedActiveSearchIndex = filteredProviders.length > 0
    ? Math.min(activeSearchIndex, filteredProviders.length - 1)
    : 0;
  const activeSearchProviderId = hasSearchQuery
    ? filteredProviders[normalizedActiveSearchIndex]?.id
    : undefined;

  useEffect(() => {
    if (!shouldRestoreSearchFocusRef.current) {
      return undefined;
    }

    shouldRestoreSearchFocusRef.current = false;

    const input = searchInputRef.current;
    if (!input) {
      return undefined;
    }

    const restoreFocus = () => {
      input.focus();
      const caretPosition = input.value.length;
      input.setSelectionRange?.(caretPosition, caretPosition);
    };

    if (typeof window === "undefined") {
      restoreFocus();
      return undefined;
    }

    const frame = window.requestAnimationFrame(restoreFocus);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [searchQuery]);

  const updateSearchQuery = (nextQuery: string) => {
    shouldRestoreSearchFocusRef.current = document.activeElement === searchInputRef.current;
    setActiveSearchIndex(0);
    setSearchQuery(nextQuery);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab") {
      event.stopPropagation();
    }

    if (!hasSearchQuery || filteredProviders.length === 0) {
      if (event.key === "Escape" && searchQuery) {
        updateSearchQuery("");
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((currentIndex) => Math.min(currentIndex + 1, filteredProviders.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Escape" && searchQuery) {
      updateSearchQuery("");
    }
  };

  return (
    <DropdownMenuContent
      data-slot="model-selector-content"
      align={align}
      className={cn(
        "max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-52 min-w-52 overflow-y-auto p-0",
        className,
      )}
      {...props}
    >
      {children ??
        <>
          <div
            data-slot="model-selector-search"
            className="sticky top-0 z-10 border-b bg-popover p-2"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                aria-label="Search providers"
                aria-activedescendant={activeSearchProviderId
                  ? `model-selector-provider-${activeSearchProviderId}`
                  : undefined}
                placeholder="Search providers..."
                value={searchQuery}
                onChange={(event) => updateSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-8 border-0 bg-muted/60 pl-8 pr-2 text-[12px] shadow-none focus-visible:ring-1"
              />
            </div>
          </div>
          <div data-slot="model-selector-provider-list" className="p-1">
            {filteredProviders.length > 0 ? (
              filteredProviders.map((provider) => (
                <ModelSelectorProvider
                  key={provider.id}
                  provider={provider}
                  searchSelected={provider.id === activeSearchProviderId}
                />
              ))
            ) : (
              <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                No providers found
              </div>
            )}
          </div>
        </>}
    </DropdownMenuContent>
  );
}

export type ModelSelectorProviderProps = Omit<
  ComponentPropsWithoutRef<typeof DropdownMenuSubTrigger>,
  "children"
> & {
  provider: ModelProviderOption;
  searchSelected?: boolean;
};

function ModelSelectorProvider({
  provider,
  searchSelected = false,
  className,
  ...props
}: ModelSelectorProviderProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        id={`model-selector-provider-${provider.id}`}
        data-slot="model-selector-provider"
        data-search-selected={searchSelected ? "true" : "false"}
        disabled={provider.disabled || provider.models.length === 0}
        className={cn(
          "min-w-0 text-[12px]",
          searchSelected && "bg-accent text-accent-foreground",
          className,
        )}
        {...props}
      >
        {provider.icon && (
          <span
            data-slot="model-selector-provider-icon"
            aria-hidden="true"
            className={cn(
              "flex size-4 shrink-0 items-center justify-center [&_img]:size-full [&_svg]:size-4",
              searchSelected && "text-accent-foreground",
            )}
          >
            {provider.icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-normal">
          {provider.name}
        </span>
        <span
          className={cn(
            "mr-4 shrink-0 text-[10px]",
            searchSelected ? "text-accent-foreground/80" : "text-muted-foreground",
          )}
        >
          {provider.models.length}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        data-slot="model-selector-models"
        className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-50 min-w-50 overflow-y-auto"
      >
        {provider.models.map((model) => (
          <ModelSelectorItem
            key={model.id}
            provider={provider}
            model={model}
            {...(model.disabled ? { disabled: true } : undefined)}
          />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export type ModelSelectorItemProps = Omit<
  ComponentPropsWithoutRef<typeof DropdownMenuItem>,
  "children"
> & {
  model: ModelOption;
  provider?: ModelProviderOption;
};

function ModelSelectorItem({
  model,
  provider,
  className,
  onSelect,
  ...props
}: ModelSelectorItemProps) {
  const { selectedModelId, onValueChange } = useModelSelectorContext();
  const isSelected = model.id === selectedModelId;
  const handleSelect: NonNullable<ModelSelectorItemProps["onSelect"]> = (
    event,
  ) => {
    onSelect?.(event);

    if (event.defaultPrevented || model.disabled) {
      return;
    }

    onValueChange(model.id);
  };

  return (
    <DropdownMenuItem
      data-slot="model-selector-item"
      data-selected={String(isSelected)}
      textValue={model.description ?? model.id}
      className={cn(
        "min-w-0 gap-2 text-[12px]",
        isSelected && "bg-accent text-accent-foreground",
        className,
      )}
      onSelect={handleSelect}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate font-normal">
        {model.description ?? model.id}
      </span>
      {provider?.id && <span className="sr-only">{provider.name}</span>}
      {isSelected && (
        <span className="absolute right-2 flex size-4 items-center justify-center">
          <CheckIcon className="size-4" />
        </span>
      )}
    </DropdownMenuItem>
  );
}

export type ModelSelectorProps = Omit<ModelSelectorRootProps, "children"> &
  Pick<ModelSelectorTriggerProps, "className"> &
  VariantProps<typeof selectTriggerVariants> & {
    contentClassName?: string;
  };

const ModelSelectorImpl = ({
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  models,
  providers,
  className,
  variant,
  size,
  contentClassName,
  ...forwardedProps
}: ModelSelectorProps) => {
  const normalizedProviders = useMemo(
    () => normalizeProviders({ models, providers }),
    [models, providers],
  );
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? getFirstModelId(normalizedProviders),
  );
  const value = isControlled ? controlledValue : internalValue;
  const onValueChange = controlledOnValueChange ?? setInternalValue;
  const api = useAssistantApi();

  useEffect(() => {
    const config = { config: { modelName: value } };
    return api.modelContext().register({
      getModelContext: () => config,
    });
  }, [api, value]);

  return (
    <ModelSelectorRoot
      providers={normalizedProviders}
      value={value}
      onValueChange={onValueChange}
      {...forwardedProps}
    >
      <ModelSelectorTrigger className={className} variant={variant} size={size} />
      <ModelSelectorContent className={contentClassName} />
    </ModelSelectorRoot>
  );
};

type ModelSelectorComponent = typeof ModelSelectorImpl & {
  displayName?: string;
  Root: typeof ModelSelectorRoot;
  Trigger: typeof ModelSelectorTrigger;
  Content: typeof ModelSelectorContent;
  Provider: typeof ModelSelectorProvider;
  Item: typeof ModelSelectorItem;
  Value: typeof ModelSelectorValue;
};

const ModelSelector = memo(
  ModelSelectorImpl,
) as unknown as ModelSelectorComponent;

ModelSelector.displayName = "ModelSelector";
ModelSelector.Root = ModelSelectorRoot;
ModelSelector.Trigger = ModelSelectorTrigger;
ModelSelector.Content = ModelSelectorContent;
ModelSelector.Provider = ModelSelectorProvider;
ModelSelector.Item = ModelSelectorItem;
ModelSelector.Value = ModelSelectorValue;

export {
  ModelSelector,
  ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorProvider,
  ModelSelectorItem,
  ModelSelectorValue,
};