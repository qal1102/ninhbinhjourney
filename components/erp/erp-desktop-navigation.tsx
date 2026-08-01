"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ErpModule, ErpSite } from "@/domain/erp";
import { groupVisibleErpModules } from "@/domain/erp-navigation";

type Props = {
  site: ErpSite;
  modules: readonly ErpModule[];
  activeModuleId?: string;
};

export function ErpDesktopNavigation({ site, modules, activeModuleId }: Props) {
  const navigationRef = useRef<HTMLElement>(null);
  const visibleGroups = groupVisibleErpModules(modules);

  useEffect(() => {
    function closeOpenGroup({ restoreFocus = false } = {}) {
      const navigation = navigationRef.current;
      const openGroup = navigation?.querySelector<HTMLDetailsElement>("details[open]");
      if (!openGroup) return;

      openGroup.removeAttribute("open");
      if (restoreFocus) {
        openGroup.querySelector<HTMLElement>("summary")?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const navigation = navigationRef.current;
      if (navigation && event.target instanceof Node && !navigation.contains(event.target)) {
        closeOpenGroup();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const navigation = navigationRef.current;
      if (!navigation?.querySelector("details[open]")) return;

      event.preventDefault();
      closeOpenGroup({ restoreFocus: true });
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <nav
      ref={navigationRef}
      aria-label={`Module ${site.shortName}`}
      className="relative hidden border-b border-[#dce2dd] bg-white lg:block"
    >
      <div className="mx-auto flex max-w-[1600px] flex-nowrap items-center gap-1 px-4 py-2 sm:px-6">
        <Link
          href={`/erp/${site.id}`}
          aria-current={!activeModuleId ? "page" : undefined}
          className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-bold leading-none transition xl:text-sm ${
            !activeModuleId
              ? "bg-[#183f34] text-white"
              : "text-[#5c6d65] hover:bg-[#eef3ef]"
          }`}
        >
          Tổng quan
        </Link>
        {visibleGroups.map((group) => {
          const active = group.modules.some(
            (module) => module.id === activeModuleId,
          );

          if (group.modules.length === 1) {
            const soleModule = group.modules[0];
            return (
              <Link
                key={group.id}
                href={`/erp/${site.id}/${soleModule.id}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-bold leading-none transition xl:text-sm ${
                  active
                    ? "bg-[#183f34] text-white"
                    : "text-[#5c6d65] hover:bg-[#eef3ef]"
                }`}
              >
                {group.shortName}
              </Link>
            );
          }

          return (
            <details
              key={group.id}
              name="erp-module-navigation"
              className="group relative shrink-0 open:z-50"
            >
              <summary
                className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-bold leading-none transition outline-none focus-visible:ring-2 focus-visible:ring-[#4f8875] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden xl:text-sm ${
                  active
                    ? "bg-[#183f34] text-white"
                    : "text-[#5c6d65] hover:bg-[#eef3ef]"
                }`}
              >
                <span>{group.shortName}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-150 group-open:rotate-180"
                >
                  <path
                    d="m4 6 4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <div
                className={`absolute top-[calc(100%+0.375rem)] z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[#d7e0da] bg-white p-1.5 shadow-xl ${
                  group.id === "finance-reports" ? "right-0" : "left-0"
                }`}
              >
                <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#87938d]">
                  {group.name}
                </p>
                {group.modules.map((module) => (
                  <Link
                    key={module.id}
                    href={`/erp/${site.id}/${module.id}`}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                      activeModuleId === module.id
                        ? "bg-[#e6f1eb] text-[#183f34]"
                        : "text-[#53665d] hover:bg-[#f0f4f1]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{module.name}</span>
                      {module.status === "planned" ? (
                        <span className="shrink-0 rounded-full bg-[#f6ecd8] px-2 py-0.5 text-[10px] font-black text-[#8a6b27]">
                          Sau
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </nav>
  );
}
