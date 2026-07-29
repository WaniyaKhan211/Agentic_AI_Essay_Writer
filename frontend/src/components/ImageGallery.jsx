function ImageGallery({ images }) {
  return (
    <div className="image-gallery">
      {images.map((image, index) => (
        <div className="image-card" key={index}>
          <img
            src={image}
            alt={`Generated ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

export default ImageGallery;