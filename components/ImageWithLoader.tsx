import React, { useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fallback: string;
};

export const ImageWithLoader: React.FC<Props> = ({
  src,
  alt,
  fallback,
  className = "",
}) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-full">
      {/* Loader */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          if (e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback;
          }
        }}
        className={[
          "object-cover w-full h-full group-hover:scale-[1.02] transition-transform duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className,
        ].join(" ")}
      />
    </div>
  );
};
