const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`rounded-lg border bg-white p-6 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;