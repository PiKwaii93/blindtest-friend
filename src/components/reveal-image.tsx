"use client";
import Image from "next/image";
import { useState } from "react";
export function RevealImage({
  src,
  title,
}: {
  src: string | null | undefined;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      width={480}
      height={270}
      unoptimized
      style={{ objectFit: "contain" }}
      className="reveal-image"
      src={!src || failed ? "/reveal-placeholder.svg" : src}
      onError={() => setFailed(true)}
      alt={
        !src || failed
          ? "Illustration musicale de remplacement"
          : `Illustration de ${title}`
      }
    />
  );
}
