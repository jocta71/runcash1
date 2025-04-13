
import React from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';

interface RouletteTrendChartProps {
  trend: { value: number }[];
}

const RouletteTrendChart = ({ trend }: RouletteTrendChartProps) => {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ff00" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8bff00" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#colorGradient)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RouletteTrendChart;
