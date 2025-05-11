import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ChartBar, BarChart, PercentIcon } from "lucide-react";

// Tipos de dados para os gráficos
interface ColorData {
  name: string;
  value: number;
  color: string;
}

interface D3ChartStatsProps {
  roletaNome?: string;
  data?: {
    colorDistribution?: ColorData[];
    frequencyData?: any[];
  };
  wins?: number;
  losses?: number;
}

const D3ChartStats: React.FC<D3ChartStatsProps> = ({ 
  roletaNome = "Roleta",
  data,
  wins = 0,
  losses = 0 
}) => {
  // Estado para armazenar dados
  const [colorDistribution, setColorDistribution] = useState<ColorData[]>([
    { name: "Vermelhos", value: 50, color: "#ef4444" },
    { name: "Pretos", value: 45, color: "#111827" },
    { name: "Zero", value: 5, color: "#059669" },
  ]);

  const [frequencyData, setFrequencyData] = useState([
    { number: "0", frequency: 5 },
    { number: "1-9", frequency: 15 },
    { number: "10-18", frequency: 20 },
    { number: "19-27", frequency: 18 },
    { number: "28-36", frequency: 12 },
  ]);

  // Refs para os elementos SVG
  const colorChartRef = useRef<SVGSVGElement>(null);
  const winRateChartRef = useRef<SVGSVGElement>(null);
  const barChartRef = useRef<SVGSVGElement>(null);

  // Atualizar dados com base nas props
  useEffect(() => {
    if (data?.colorDistribution) {
      setColorDistribution(data.colorDistribution);
    }
    
    if (data?.frequencyData) {
      setFrequencyData(data.frequencyData);
    }
  }, [data, wins, losses]);

  // Renderizar gráfico de distribuição de cores com D3
  useEffect(() => {
    if (colorChartRef.current) {
      // Limpar o SVG existente
      d3.select(colorChartRef.current).selectAll("*").remove();

      // Configurações do gráfico
      const width = 260;
      const height = 260;
      const margin = 20;
      const radius = Math.min(width, height) / 2 - margin;

      // Criar o SVG
      const svg = d3.select(colorChartRef.current)
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

      // Dados para o pie chart
      const pie = d3.pie<any>()
        .value(d => d.value)
        .sort(null);

      const data_ready = pie(colorDistribution);

      // Arcos
      const arcGenerator = d3.arc<any>()
        .innerRadius(radius * 0.4)
        .outerRadius(radius);

      // Adicionar arcos
      svg.selectAll('slices')
        .data(data_ready)
        .enter()
        .append('path')
        .attr('d', arcGenerator)
        .attr('fill', d => d.data.color)
        .attr('stroke', '#141318')
        .style('stroke-width', '2px')
        .style('opacity', 0.8)
        .on('mouseover', function() {
          d3.select(this).style('opacity', 1);
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 0.8);
        });

      // Labels
      svg.selectAll('labels')
        .data(data_ready)
        .enter()
        .append('text')
        .text(d => `${d.data.name}: ${d.data.value}%`)
        .attr('transform', d => `translate(${arcGenerator.centroid(d)})`)
        .style('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#ffffff');

      // Adicionar legenda
      const legend = svg.selectAll('.legend')
        .data(data_ready)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(${radius * 0.7}, ${-radius + i * 20})`);

      legend.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d => d.data.color);

      legend.append('text')
        .attr('x', 15)
        .attr('y', 10)
        .text(d => d.data.name)
        .style('font-size', '10px')
        .style('fill', '#cccccc');
    }
  }, [colorDistribution]);

  // Renderizar gráfico de taxa de vitória com D3
  useEffect(() => {
    if (winRateChartRef.current) {
      // Limpar o SVG existente
      d3.select(winRateChartRef.current).selectAll("*").remove();

      // Configurações do gráfico
      const width = 260;
      const height = 260;
      const margin = 20;
      const radius = Math.min(width, height) / 2 - margin;

      // Dados para o gráfico
      const data = [
        { name: "Vitórias", value: wins || 1, color: "#059669" },
        { name: "Derrotas", value: losses || 1, color: "#ef4444" }
      ];

      // Criar o SVG
      const svg = d3.select(winRateChartRef.current)
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

      // Dados para o pie chart
      const pie = d3.pie<any>()
        .value(d => d.value)
        .sort(null);

      const data_ready = pie(data);

      // Arcos
      const arcGenerator = d3.arc<any>()
        .innerRadius(radius * 0.6)
        .outerRadius(radius);

      // Adicionar arcos
      svg.selectAll('slices')
        .data(data_ready)
        .enter()
        .append('path')
        .attr('d', arcGenerator)
        .attr('fill', d => d.data.color)
        .attr('stroke', '#141318')
        .style('stroke-width', '2px')
        .style('opacity', 0.8)
        .on('mouseover', function() {
          d3.select(this).style('opacity', 1);
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 0.8);
        });

      // Adicionar texto no centro
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
      
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.5em')
        .style('fill', '#ffffff')
        .style('font-size', '16px')
        .text(`${winRate}%`);
        
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1em')
        .style('fill', '#cccccc')
        .style('font-size', '12px')
        .text('Taxa de Vitória');

      // Labels
      svg.selectAll('labels')
        .data(data_ready)
        .enter()
        .append('text')
        .text(d => `${d.data.name}: ${d.data.value}`)
        .attr('transform', d => {
          const pos = arcGenerator.centroid(d);
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          pos[0] = radius * 0.9 * (midAngle < Math.PI ? 1 : -1);
          return `translate(${pos})`;
        })
        .style('text-anchor', d => {
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          return midAngle < Math.PI ? 'start' : 'end';
        })
        .style('font-size', '10px')
        .style('fill', '#ffffff');

      // Linhas para conectar labels
      svg.selectAll('polylines')
        .data(data_ready)
        .enter()
        .append('polyline')
        .attr('points', d => {
          const pos = arcGenerator.centroid(d);
          const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          pos[0] = radius * 0.8 * (midAngle < Math.PI ? 1 : -1);
          return [arcGenerator.centroid(d), pos];
        })
        .style('fill', 'none')
        .style('stroke', '#cccccc')
        .style('stroke-width', '1px');
    }
  }, [wins, losses]);

  // Renderizar gráfico de barras para frequência com D3
  useEffect(() => {
    if (barChartRef.current && frequencyData.length > 0) {
      // Limpar o SVG existente
      d3.select(barChartRef.current).selectAll("*").remove();

      // Configurações do gráfico
      const width = barChartRef.current.clientWidth || 600;
      const height = 300;
      const margin = { top: 20, right: 30, bottom: 40, left: 50 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      // Criar o SVG
      const svg = d3.select(barChartRef.current)
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

      // Escalas X e Y
      const x = d3.scaleBand()
        .domain(frequencyData.map(d => d.number))
        .range([0, chartWidth])
        .padding(0.2);

      const y = d3.scaleLinear()
        .domain([0, d3.max(frequencyData, d => d.frequency) || 0])
        .nice()
        .range([chartHeight, 0]);

      // Adicionar eixo X
      svg.append("g")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("fill", "#cccccc")
        .style("font-size", "10px");

      // Adicionar eixo Y
      svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#cccccc")
        .style("font-size", "10px");

      // Adicionar grade
      svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
          .tickSize(-chartWidth)
          .tickFormat(() => '')
        )
        .selectAll("line")
        .style("stroke", "#333333")
        .style("stroke-dasharray", "3,3");

      // Adicionar barras
      svg.selectAll(".bar")
        .data(frequencyData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.number) || 0)
        .attr("y", d => y(d.frequency))
        .attr("width", x.bandwidth())
        .attr("height", d => chartHeight - y(d.frequency))
        .attr("fill", "#059669")
        .attr("rx", 4)
        .attr("ry", 4)
        .style("opacity", 0.8)
        .on("mouseover", function(event, d) {
          d3.select(this).style("opacity", 1);
          
          // Tooltip
          svg.append("text")
            .attr("class", "tooltip")
            .attr("x", (x(d.number) || 0) + x.bandwidth() / 2)
            .attr("y", y(d.frequency) - 10)
            .attr("text-anchor", "middle")
            .style("fill", "#ffffff")
            .style("font-size", "12px")
            .text(d.frequency);
        })
        .on("mouseout", function() {
          d3.select(this).style("opacity", 0.8);
          svg.selectAll(".tooltip").remove();
        });

      // Adicionar rótulos
      svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${chartWidth / 2}, ${chartHeight + margin.bottom - 5})`)
        .style("fill", "#cccccc")
        .style("font-size", "12px")
        .text("Intervalos de Números");

      svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${-margin.left / 2}, ${chartHeight / 2}) rotate(-90)`)
        .style("fill", "#cccccc")
        .style("font-size", "12px")
        .text("Frequência");
    }
  }, [frequencyData]);

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
        <div className="p-5 space-y-4 bg-opacity-50 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Distribuição por Cor
          </h3>
          <div className="h-[260px] w-full flex justify-center">
            <svg ref={colorChartRef} className="w-full h-full"></svg>
          </div>
        </div>
        
        {/* Taxa de Vitória */}
        <div className="p-5 space-y-4 bg-opacity-50 bg-gray-900 border border-gray-700 rounded-xl">
          <h3 className="text-sm font-medium text-white flex items-center">
            <PercentIcon size={20} className="text-green-500 mr-2" /> Taxa de Vitória
          </h3>
          <div className="h-[260px] w-full flex justify-center">
            <svg ref={winRateChartRef} className="w-full h-full"></svg>
          </div>
        </div>

        {/* Frequência de Números */}
        <div className="p-5 space-y-4 bg-opacity-50 bg-gray-900 border border-gray-700 rounded-xl md:col-span-2">
          <h3 className="text-sm font-medium text-white flex items-center">
            <ChartBar size={20} className="text-green-500 mr-2" /> Frequência de Números
          </h3>
          <div className="h-[300px] w-full flex justify-center">
            <svg ref={barChartRef} className="w-full h-full"></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default D3ChartStats; 