import { useEffect, useState } from "react";

import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

import "../styles/gallery.css";

function ImageGallery({ images }) {

  const [activeIndex, setActiveIndex] = useState(null);
  const hasImages = images && images.length > 0;
  const count = hasImages ? images.length : 0;
  const openLightbox = (index) => setActiveIndex(index);
  const closeLightbox = () => setActiveIndex(null);
  const showPrev = (e) => {

    e?.stopPropagation();

    setActiveIndex((i) => (i === 0 ? count - 1 : i - 1));

  };

  const showNext = (e) => {

    e?.stopPropagation();

    setActiveIndex((i) => (i === count - 1 ? 0 : i + 1));

  };

  // Keyboard support for the lightbox: Left/Right to navigate, Escape to close.

  // Hook must stay above any early return so it's always called in the same order.

  useEffect(() => {

    if (activeIndex === null) return;

    const handleKeyDown = (e) => {

      if (e.key === "ArrowLeft" && count > 1) {

        showPrev();

      } else if (e.key === "ArrowRight" && count > 1) {

        showNext();

      } else if (e.key === "Escape") {

        closeLightbox();

      }

    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [activeIndex, count]);

  if (!hasImages) return null;

  const active = activeIndex !== null ? images[activeIndex] : null;

  return (

    <>

      <div className="image-gallery">

        {images.map((img, index) => (

          <div

            className="image-card"

            key={index}

            onClick={() => openLightbox(index)}

          >

            <img src={img.image} alt={img.title || `Generated ${index + 1}`} />

            {img.title && <p className="image-caption image-caption-title">{img.title}</p>}
            {img.caption && <p className="image-caption image-caption-benefit">{img.caption}</p>}

          </div>

        ))}

      </div>

      {active && (

        <div className="lightbox-overlay" onClick={closeLightbox}>

          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>

            <button className="lightbox-close" onClick={closeLightbox}>

              <FiX size={20} />

            </button>

            {images.length > 1 && (

              <button className="lightbox-nav left" onClick={showPrev}>

                <FiChevronLeft size={24} />

              </button>

            )}

            <img className="lightbox-image" src={active.image} alt={active.title} />

            {images.length > 1 && (

              <button className="lightbox-nav right" onClick={showNext}>

                <FiChevronRight size={24} />

              </button>

            )}

            <p className="lightbox-caption lightbox-caption-title">{active.title}</p>
            {active.caption && (
              <p className="lightbox-caption lightbox-caption-benefit">{active.caption}</p>
            )}

          </div>

        </div>

      )}

    </>

  );

}

export default ImageGallery;