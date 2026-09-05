const Button = ({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}) => {
  const baseClasses =
    'rounded-md px-4 py-2 font-medium transition-colors';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-gray-300 bg-white hover:bg-gray-100',
  };

  const buttonVariant = variants[variant] ?? variants.primary;

  return (
    <button
      type={type}
      className={`${baseClasses} ${buttonVariant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;