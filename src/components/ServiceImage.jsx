import { useState } from 'react'
import { FiPackage, FiShoppingBag, FiTool } from 'react-icons/fi'

const fallbackIcons = {
  laundry: FiShoppingBag,
  cleaning: FiTool,
  delivery: FiPackage,
}

function ServiceImage({ image, tone, alt = '' }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const FallbackIcon = fallbackIcons[tone]

  return (
    <div className={`service-image-shell service-image-${tone}`} aria-busy={!loaded && !failed}>
      {!loaded && !failed && <span className="service-image-placeholder" aria-hidden="true" />}
      {failed
        ? <FallbackIcon className="service-image-fallback" aria-hidden="true" />
        : (
          <img
            className={`service-image${loaded ? ' is-loaded' : ''}`}
            src={image}
            alt={alt}
            width="640"
            height="400"
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
    </div>
  )
}

export default ServiceImage
