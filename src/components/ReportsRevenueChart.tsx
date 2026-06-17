import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCurrencySymbol } from '../lib/currencies';

interface MonthlyRevenueDatum {
  month: string;
  billed: number;
  collected: number;
}

interface ReportsRevenueChartProps {
  data: MonthlyRevenueDatum[];
  currency: string;
  formatCurrency: (amount: number) => string;
}

export function ReportsRevenueChart({ data, currency, formatCurrency }: ReportsRevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${getCurrencySymbol(currency)}${(Number(value) / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(Number(value))}
          contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e4e4e7', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="billed" name="Billed" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
