export const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const CYCLE_SUFFIX = { month: '/ mo', year: '/ yr' };

export const formatPrice = (item) =>
  item.cycle ? `${formatINR(item.price)} ${CYCLE_SUFFIX[item.cycle]}` : formatINR(item.price);
