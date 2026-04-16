"use client";

import { useEffect, useState, useRef } from "react";
import { Autocomplete, BlockStack, Text, Thumbnail } from "@shopify/polaris";

export interface Product {
  id: number;
  title: string;
  handle: string;
  status: string;
  image: { src: string } | null;
  variants: { id: number; title: string; price: string }[];
}

export function isDefaultVariantTitle(title: string) {
  const value = String(title || "").trim().toLowerCase();
  return !value || value === "default title" || value === "default" || value === "main";
}

export function hasMeaningfulVariants(product: Product | undefined | null) {
  if (!product?.variants?.length) return false;
  if (product.variants.length > 1) return true;
  return !isDefaultVariantTitle(product.variants[0]?.title ?? "");
}

export function bxgyOptionLabel(product: Product, variant: Product["variants"][number]) {
  if (!hasMeaningfulVariants(product)) return product.title;
  return `${product.title} - ${variant.title}`;
}

export function SearchableProductSelect({
  products,
  value,
  onChange,
  placeholder,
  style,
}: {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedProduct = products.find((product) => String(product.id) === value) ?? null;

  useEffect(() => {
    setQuery(selectedProduct?.title ?? "");
  }, [selectedProduct?.title]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selectedProduct?.title ?? "");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [selectedProduct?.title]);

  // Close on scroll so the fixed dropdown doesn't detach from the input
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  const openDropdown = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = normalizedQuery
    ? products.filter((product) =>
        `${product.title} ${product.handle}`.toLowerCase().includes(normalizedQuery),
      )
    : products;

  const visibleProducts = filteredProducts.slice(0, 12);

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={openDropdown}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          openDropdown();
          if (!nextValue.trim()) onChange("");
        }}
        style={{
          width: "100%",
          padding: "0.7rem 0.8rem",
          border: "1px solid #d1d5db",
          borderRadius: "10px",
          fontSize: "0.875rem",
          background: "#fff",
          color: "#1a1a1a",
          boxSizing: "border-box",
        }}
      />
      {open && dropdownPos && (
        <div
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
            maxHeight: "280px",
            overflowY: "auto",
            zIndex: 9999,
          }}
        >
          {visibleProducts.length === 0 ? (
            <p style={{ margin: 0, padding: "0.75rem 0.85rem", fontSize: "0.82rem", color: "#6b7280" }}>
              No products found
            </p>
          ) : (
            visibleProducts.map((product) => {
              const isSelected = String(product.id) === value;
              return (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(String(product.id));
                    setQuery(product.title);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    background: isSelected ? "#f0fdf4" : "#fff",
                    padding: "0.72rem 0.85rem",
                    textAlign: "left",
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>{product.title}</div>
                  <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: "0.12rem" }}>{product.handle}</div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function PolarisProductAutocomplete({
  products,
  value,
  onChange,
  label,
  placeholder,
  helpText,
  disabled,
}: {
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  helpText?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const selectedProduct = products.find((product) => String(product.id) === value) ?? null;

  useEffect(() => {
    setQuery(selectedProduct?.title ?? "");
  }, [selectedProduct?.title]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = normalizedQuery
    ? products.filter((product) => `${product.title} ${product.handle}`.toLowerCase().includes(normalizedQuery))
    : products;

  const options = filteredProducts.slice(0, 12).map((product) => ({
    value: String(product.id),
    label: product.title,
    media: product.image?.src ? <Thumbnail source={product.image.src} alt={product.title} size="small" /> : undefined,
  }));

  const textField = (
    <Autocomplete.TextField
      label={label}
      value={query}
      placeholder={placeholder}
      autoComplete="off"
      disabled={disabled}
      onChange={(nextValue) => {
        setQuery(nextValue);
        if (!nextValue.trim()) {
          onChange("");
        }
      }}
      clearButton
      onClearButtonClick={() => {
        setQuery("");
        onChange("");
      }}
    />
  );

  return (
    <BlockStack gap="200">
      <Autocomplete
        options={disabled ? [] : options}
        selected={value ? [value] : []}
        textField={textField}
        onSelect={(selected) => {
          const nextValue = selected[0] ?? "";
          onChange(nextValue);
          const nextProduct = products.find((product) => String(product.id) === nextValue);
          setQuery(nextProduct?.title ?? "");
        }}
        emptyState={<Text as="p" variant="bodySm" tone="subdued">No products found</Text>}
      />
      {helpText && (
        <Text as="p" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      )}
    </BlockStack>
  );
}
