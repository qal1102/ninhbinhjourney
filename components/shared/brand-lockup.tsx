import Image from "next/image";
import Link from "next/link";

export function BrandLockup({
  href = "/",
  inverse = false,
  product,
}: {
  href?: string;
  inverse?: boolean;
  product?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Ninh Bình"
      className={`inline-flex min-h-11 items-center gap-3 ${
        inverse ? "text-white" : "text-[#183f34]"
      }`}
    >
      <span className="relative h-11 w-11 shrink-0" aria-hidden="true">
        <Image
          src="/brand/ninh-binh-mark.png"
          alt=""
          fill
          sizes="44px"
          className="object-contain"
        />
      </span>
      <span className="leading-none">
        <span className="font-display block text-xl tracking-[-0.02em]">
          Ninh Bình
        </span>
        {product ? (
          <span
            className={`mt-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.2em] ${
              inverse ? "text-white/52" : "text-[#59654b]"
            }`}
          >
            {product}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
