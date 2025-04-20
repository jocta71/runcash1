import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { ChartBar, BarChart, PercentIcon } from "lucide-react";

// Tipos de dados para os gráficos
interface ColorData {
  name: string;
  value: number;
  color: string;
}

interface ApexChartStatsProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorData[];
    frequencyData?: any[];
  };
  wins?: number;
  losses?: number;
}

const ApexChartStats: React.FC<ApexChartStatsProps> = ({ 
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0 
}) => {
  // Configuração do gráfico de distribuição de cores
  const [colorDistribution, setColorDistribution] = useState<ColorData[]>([
    { name: "Vermelhos", value: 50, color: "#ef4444" },
    { name: "Pretos", value: 45, color: "#111827" },
    { name: "Zero", value: 5, color: "#059669" },
  ]);

  // Configuração do gráfico de Vitórias/Derrotas
  const [winRateOptions, setWinRateOptions] = useState<ApexOptions>({
    chart: {
      type: 'donut',
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    labels: ['Vitórias', 'Derrotas'],
    colors: ['#059669', '#ef4444'],
    plotOptions: {
      pie: {
        donut: {
          size: '55%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toString();
              }
            }
          }
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return val.toFixed(1) + "%";
      }
    },
    legend: {
      position: 'bottom',
      labels: {
        colors: '#fff'
      }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function(val: number) {
          return val.toString();
        }
      }
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 280
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    ]
  });

  const [winRateSeries, setWinRateSeries] = useState<number[]>([wins || 1, losses || 1]);

  // Configuração do gráfico de barras de frequência
  const [frequencyOptions, setFrequencyOptions] = useState<ApexOptions>({
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '70%',
        borderRadius: 6,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return val.toString();
      },
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#fff']
      }
    },
    xaxis: {
      categories: ['0', '1-9', '10-18', '19-27', '28-36'],
      labels: {
        style: {
          colors: '#ccc'
        }
      },
      axisBorder: {
        show: true,
        color: '#444'
      },
      axisTicks: {
        show: true,
        color: '#444'
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#ccc'
        }
      }
    },
    fill: {
      colors: ['#059669'],
      opacity: 1
    },
    grid: {
      borderColor: '#333',
      row: {
        colors: ['transparent', 'transparent']
      }
    },
    tooltip: {
      theme: 'dark'
    }
  });

  const [frequencySeries, setFrequencySeries] = useState<
    { name: string; data: number[] }[]
  >([
    { 
      name: 'Frequência', 
      data: [5, 15, 20, 18, 12]
    }
  ]);

  // Configuração do gráfico de torta para distribuição de cores
  const [colorOptions, setColorOptions] = useState<ApexOptions>({
    chart: {
      type: 'pie',
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    labels: colorDistribution.map(d => d.name),
    colors: colorDistribution.map(d => d.color),
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return val.toFixed(1) + "%";
      }
    },
    legend: {
      position: 'bottom',
      labels: {
        colors: '#fff'
      }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function(val: number) {
          return val.toString() + "%";
        }
      }
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 280
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    ]
  });

  const [colorSeries, setColorSeries] = useState<number[]>(colorDistribution.map(d => d.value));

  // Atualizar dados com base nas props
  useEffect(() => {
    if (data?.colorDistribution) {
      setColorDistribution(data.colorDistribution);
      setColorOptions(prev => ({
        ...prev,
        labels: data.colorDistribution?.map(d => d.name) || [],
        colors: data.colorDistribution?.map(d => d.color) || []
      }));
      setColorSeries(data.colorDistribution?.map(d => d.value) || []);
    }
    
    if (data?.frequencyData) {
      const categories = data.frequencyData.map((item: any) => item.number || item.x);
      const values = data.frequencyData.map((item: any) => item.frequency || item.y);
      
      setFrequencyOptions(prev => ({
        ...prev,
        xaxis: {
          ...prev.xaxis,
          categories
        }
      }));
      
      setFrequencySeries([{
        name: 'Frequência',
        data: values
      }]);
    }
    
    if (wins || losses) {
      setWinRateSeries([wins, losses]);
    }
  }, [data, wins, losses]);

  return (
    <div className="w-full h-full fixed right-0 top-0 bg-[#141318] border-l border-[#2a2a2e] overflow-y-auto">
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <h2 className="text-white flex items-center text-xl font-bold mb-3">
          <BarChart className="mr-3 text-green-500 h-6 w-6" /> 
          Estatísticas da {roletaNome}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
        {/* Distribuição por Cor */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Distribuição por Cor
          </h3>
          <div className="h-[260px] w-full">
            <Chart 
              options={colorOptions} 
              series={colorSeries} 
              type="pie" 
              height={260} 
            />
          </div>
        </div>
        
        {/* Taxa de Vitória */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <PercentIcon size={20} className="text-green-500 mr-2" /> Taxa de Vitória
          </h3>
          <div className="h-[260px] w-full">
            <Chart 
              options={winRateOptions} 
              series={winRateSeries} 
              type="donut" 
              height={260} 
            />
          </div>
        </div>

        {/* Frequência de Números */}
        <div className="p-5 space-y-4 bg-opacity-50 border border-gray-700 rounded-xl md:col-span-2">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Frequência de Números
          </h3>
          <div className="h-[300px] w-full">
            <Chart 
              options={frequencyOptions} 
              series={frequencySeries} 
              type="bar" 
              height={300} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApexChartStats; 