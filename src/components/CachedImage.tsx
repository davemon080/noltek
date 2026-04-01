import React from 'react';

type CachedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  wrapperClassName?: string;
  imgClassName?: string;
  skeletonClassName?: string;
  fallbackSrc?: string;
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
  loading = 'lazy',
  decoding = 'async',
  ...props
}: CachedImageProps) {
  const resolvedSrc = src || fallbackSrc;
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
        if (fallbackSrc && fallbackSrc !== resolvedSrc) {
          setActiveSrc(fallbackSrc);
          setIsLoaded(loadedImageUrls.has(fallbackSrc));
          preloadImage(fallbackSrc)
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
  }, [resolvedSrc, fallbackSrc]);

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
          if (fallbackSrc && activeSrc !== fallbackSrc) {
            setActiveSrc(fallbackSrc);
            setIsLoaded(loadedImageUrls.has(fallbackSrc));
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
