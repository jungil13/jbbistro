const fs = require('fs');
const filePath = 'components/ReservationDetailsModal.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// Replace status line
code = code.replace(
  'const [currentStatus, setCurrentStatus] = useState(reservation.status);',
  `const [currentStatus, setCurrentStatus] = useState(reservation.status);
  const isBookingRefunded = Boolean(
    reservation.payments?.some((p) => p.status === 'refunded') ||
    refunds.some((r) => r.status === 'succeeded' || r.status === 'completed') ||
    reservation.notes?.includes('[PayMongo Refund Succeeded:')
  );
  const displayStatus = isBookingRefunded ? 'refunded' : currentStatus;`
);

code = code.replace(
  '${statusColors[reservation.status] ?? statusColors.pending}',
  '${statusColors[displayStatus] ?? statusColors.pending}'
);

code = code.replace(
  '{reservation.status}',
  '{displayStatus}'
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated ReservationDetailsModal.tsx');
