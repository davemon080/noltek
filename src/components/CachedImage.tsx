import React from 'react';

type CachedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  wrapperClassName?: string;
  imgClassName?: string;
  skeletonClassName?: string;
  fallbackSrc?: string;
  fallbackMode?: 'avatar' | 'post' | 'media' | 'logo';
};

declare global {
  interface Window {
    __connectLoadedImageUrls?: Set<string>;
  }
}

const loadedImageUrls =
  typeof window !== 'undefined'
    ? (window.__connectLoadedImageUrls ||= new Set<string>())
    : new Set<string>();
const pendingImageLoads = new Map<string, Promise<void>>();

function rememberLoadedImageUrl(src: string) {
  loadedImageUrls.add(src);
}

function toDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getInitials(label?: string) {
  const tokens = String(label || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) return 'C';
  return tokens.map((token) => token[0]?.toUpperCase() || '').join('') || 'C';
}

function createFallbackImage(mode: NonNullable<CachedImageProps['fallbackMode']>, label?: string) {
  if (mode === 'avatar') {
    return toDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="avatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#d1fae5" />
            <stop offset="100%" stop-color="#bfdbfe" />
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="28" fill="url(#avatarBg)" />
        <circle cx="60" cy="46" r="20" fill="#ffffff" fill-opacity="0.92" />
        <path d="M28 98c6-20 23-30 32-30s26 10 32 30" fill="#ffffff" fill-opacity="0.92" />
        <text x="60" y="110" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#0f766e">${getInitials(label)}</text>
      </svg>
    `);
  }

  if (mode === 'logo') {
    return toDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
        <defs>
          <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc" />
            <stop offset="100%" stop-color="#dbeafe" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" rx="24" fill="url(#logoBg)" />
        <rect x="28" y="28" width="104" height="64" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="4" />
        <path d="M52 76V50h16c10 0 16 5 16 13s-6 13-16 13H52zm16-9c4 0 6-1 6-4s-2-4-6-4h-6v8h6zm26 9V50h10v26H94zm16 0V50h26v9h-16v3h14v8h-14v6h-10z" fill="#0f766e" />
      </svg>
    `);
  }

  if (mode === 'post') {
    return toDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
        <defs>
          <linearGradient id="postBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ecfeff" />
            <stop offset="100%" stop-color="#e0e7ff" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" rx="24" fill="url(#postBg)" />
        <rect x="24" y="24" width="112" height="72" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="4" />
        <circle cx="56" cy="50" r="10" fill="#99f6e4" />
        <path d="M40 82l20-20 14 14 12-10 24 16H40z" fill="#5eead4" />
        <text x="80" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#0f766e">POST</text>
      </svg>
    `);
  }

  return toDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
      <defs>
        <linearGradient id="mediaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" rx="24" fill="url(#mediaBg)" />
      <rect x="24" y="24" width="112" height="72" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="4" />
      <circle cx="55" cy="51" r="9" fill="#cbd5e1" />
      <path d="M40 82l20-20 16 16 14-12 30 16H40z" fill="#94a3b8" />
      <text x="80" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#475569">IMAGE</text>
    </svg>
  `);
}

function preloadImage(src: string): Promise<void> {
  if (loadedImageUrls.has(src)) return Promise.resolve();
  const pending = pendingImageLoads.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => {
      rememberLoadedImageUrl(src);
      pendingImageLoads.delete(src);
      resolve();
    };
    image.onerror = () => {
      pendingImageLoads.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
    image.src = src;
  });

  pendingImageLoads.set(src, promise);
  return promise;
}

export function markImageAsCached(src?: string | null) {
  if (!src) return;
  rememberLoadedImageUrl(src);
}

export function preloadCachedImage(src?: string | null) {
  if (!src || typeof window === 'undefined') return Promise.resolve();
  return preloadImage(src).catch(() => undefined);
}

export default function CachedImage({
  src,
  alt,
  className,
  wrapperClassName,
  imgClassName,
  skeletonClassName,
  fallbackSrc,
  fallbackMode = 'media',
  loading = 'lazy',
  decoding = 'async',
  ...props
}: CachedImageProps) {
  const generatedFallbackSrc = React.useMemo(
    () => fallbackSrc || createFallbackImage(fallbackMode, alt),
    [alt, fallbackMode, fallbackSrc]
  );
  const resolvedSrc = src || generatedFallbackSrc;
  const [activeSrc, setActiveSrc] = React.useState(resolvedSrc);
  const [isLoaded, setIsLoaded] = React.useState(() => (resolvedSrc ? loadedImageUrls.has(resolvedSrc) : false));
  const imageRef = React.useRef<HTMLImageElement | null>(null);

  React.useEffect(() => {
    setActiveSrc(resolvedSrc);
    setIsLoaded(resolvedSrc ? loadedImageUrls.has(resolvedSrc) : false);

    if (!resolvedSrc || typeof window === 'undefined' || loadedImageUrls.has(resolvedSrc)) {
      return;
    }

    let cancelled = false;
    preloadImage(resolvedSrc)
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (generatedFallbackSrc && generatedFallbackSrc !== resolvedSrc) {
          setActiveSrc(generatedFallbackSrc);
          setIsLoaded(loadedImageUrls.has(generatedFallbackSrc));
          preloadImage(generatedFallbackSrc)
            .then(() => {
              if (!cancelled) setIsLoaded(true);
            })
            .catch(() => {
              if (!cancelled) setIsLoaded(true);
            });
          return;
        }
        setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [generatedFallbackSrc, resolvedSrc]);

  React.useEffect(() => {
    if (!activeSrc) return;
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      rememberLoadedImageUrl(activeSrc);
      setIsLoaded(true);
    }
  }, [activeSrc]);

  if (!activeSrc) {
    return <div aria-hidden="true" className={wrapperClassName || className} />;
  }

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${wrapperClassName || className || ''}`}>
      {!isLoaded && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 overflow-hidden bg-slate-200 ${skeletonClassName || ''}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-white/60 to-slate-200 opacity-80 animate-pulse" />
          <div
            className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
            style={{ animation: 'cached-image-shimmer 1.3s ease-in-out infinite' }}
          />
        </div>
      )}
      <img
        {...props}
        ref={imageRef}
        src={activeSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={`${imgClassName || className || ''} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(event) => {
          rememberLoadedImageUrl(activeSrc);
          setIsLoaded(true);
          props.onLoad?.(event);
        }}
        onError={(event) => {
          if (generatedFallbackSrc && activeSrc !== generatedFallbackSrc) {
            setActiveSrc(generatedFallbackSrc);
            setIsLoaded(loadedImageUrls.has(generatedFallbackSrc));
          } else {
            setIsLoaded(true);
          }
          props.onError?.(event);
        }}
      />
      <style>{`
        @keyframes cached-image-shimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
