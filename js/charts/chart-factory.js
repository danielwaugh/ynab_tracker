/**
 * Apache ECharts Factory & Interactive Visualization Builders
 */
import { EChartsTheme } from './echarts-theme.js';
import { FinancialMath } from '../services/financial-math.js';

// Registry of active chart instances for theme changes & responsive resizes
const chartInstances = new Map();

window.addEventListener('resize', () => {
  for (const chart of chartInstances.values()) {
    if (chart && !chart.isDisposed()) {
      chart.resize();
    }
  }
});

export const ChartFactory = {
  getOrInitChart(container) {
    if (!container) return null;
    let chart = chartInstances.get(container);
    if (!chart || chart.isDisposed()) {
      chart = window.echarts.init(container);
      chartInstances.set(container, chart);

      // Auto-resize with ResizeObserver
      const ro = new ResizeObserver(() => {
        if (chart && !chart.isDisposed()) chart.resize();
      });
      ro.observe(container);
    }
    return chart;
  },

  disposeAll() {
    for (const [container, chart] of chartInstances.entries()) {
      if (chart && !chart.isDisposed()) chart.dispose();
    }
    chartInstances.clear();
  },

  /**
   * Home View: Burn Rate & Runway Gauge
   */
  renderBurnRateGauge(container, currentSpendMilliunits, targetBudgetMilliunits) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const spend = currentSpendMilliunits / 1000.0;
    const budget = (targetBudgetMilliunits || currentSpendMilliunits * 1.2) / 1000.0;
    const pct = budget > 0 ? Math.min(150, Math.round((spend / budget) * 100)) : 0;

    const option = {
      backgroundColor: tokens.backgroundColor,
      series: [
        {
          type: 'gauge',
          center: ['50%', '72%'],
          radius: '95%',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 150,
          splitNumber: 3,
          itemStyle: {
            color: pct > 100 ? tokens.expenseColor : pct > 80 ? '#f59e0b' : tokens.incomeColor
          },
          progress: {
            show: true,
            roundCap: true,
            width: 14
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '14%',
            width: 10,
            offsetCenter: [0, '-58%'],
            itemStyle: {
              color: 'auto'
            }
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 14,
              color: [
                [0.7, '#10b981'],
                [0.9, '#f59e0b'],
                [1.0, '#ef4444'],
                [1.5, '#b91c1c']
              ]
            }
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: {
            show: true,
            offsetCenter: [0, '-12%'],
            fontSize: 13,
            fontWeight: 500,
            color: tokens.textColor
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '26%'],
            fontSize: 22,
            fontWeight: 'bold',
            color: tokens.titleColor,
            formatter: (v) => `${v}% of Budget`
          },
          data: [
            {
              value: pct,
              name: 'Burn Pacing'
            }
          ]
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Cash Flow View: Multi-Tier Sankey Diagram
   */
  renderSankeyDiagram(container, sankeyData) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        formatter: (params) => {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/><b>${FinancialMath.formatCurrency(params.data.value * 1000)}</b>`;
          }
          return `<b>${params.name}</b><br/>Total: ${FinancialMath.formatCurrency(params.value * 1000)}`;
        }
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          nodeAlign: 'left',
          nodeGap: 16,
          nodeWidth: 22,
          left: '3%',
          right: '18%',
          top: '6%',
          bottom: '6%',
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.45
          },
          label: {
            color: tokens.titleColor,
            fontSize: 11,
            fontWeight: 500
          },
          data: sankeyData.nodes,
          links: sankeyData.links
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Cash Flow View: 365-Day Spending Velocity Heatmap
   */
  renderSpendingHeatmap(container, spendingRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    // Map rows to [date, amount_dollars]
    const data = spendingRows.map(r => [r.date, Math.round(r.total_expense / 1000)]);
    const currentYear = new Date().getFullYear();

    const maxSpend = data.reduce((max, item) => Math.max(max, item[1]), 100);

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        position: 'top',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        formatter: (params) => {
          return `${params.value[0]}<br/><b>$${params.value[1].toLocaleString()}</b> spent`;
        }
      },
      visualMap: {
        min: 0,
        max: Math.min(maxSpend, 300),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        inRange: {
          color: tokens.isDark 
            ? ['#1e293b', '#065f46', '#059669', '#10b981', '#34d399', '#f43f5e']
            : ['#f1f5f9', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#f43f5e']
        },
        textStyle: { color: tokens.textColor }
      },
      calendar: {
        top: 40,
        left: 40,
        right: 30,
        cellSize: ['auto', 16],
        range: currentYear,
        itemStyle: {
          borderWidth: 2,
          borderColor: tokens.isDark ? '#0f172a' : '#ffffff'
        },
        yearLabel: { show: false },
        monthLabel: { color: tokens.textColor, fontSize: 11 },
        dayLabel: { color: tokens.textColor, fontSize: 10, firstDay: 1 },
        splitLine: {
          lineStyle: {
            color: tokens.splitLineColor,
            width: 1
          }
        }
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: data
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Cash Flow View: Payee Pareto (80/20 Analysis)
   */
  renderPayeeParetoChart(container, paretoRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const topPayees = paretoRows.slice(0, 15);
    const names = topPayees.map(p => p.payeeName);
    const amounts = topPayees.map(p => Math.round(p.totalSpent / 1000));
    const cumulative = topPayees.map(p => Math.round(p.cumulativePercentage));

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Spent ($)', 'Cumulative %'],
        textStyle: { color: tokens.textColor },
        top: 5
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          color: tokens.textColor,
          interval: 0,
          rotate: 35,
          fontSize: 11
        },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Spent ($)',
          axisLabel: { color: tokens.textColor, formatter: '${value}' },
          splitLine: { lineStyle: { color: tokens.splitLineColor } }
        },
        {
          type: 'value',
          name: 'Cumulative %',
          min: 0,
          max: 100,
          axisLabel: { color: tokens.textColor, formatter: '{value}%' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Spent ($)',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: '#6366f1',
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: 'Cumulative %',
          type: 'line',
          yAxisIndex: 1,
          data: cumulative,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 3 },
          markLine: {
            data: [
              {
                yAxis: 80,
                name: '80% Pareto Cutoff',
                lineStyle: { color: '#ef4444', type: 'dashed', width: 2 }
              }
            ]
          }
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Net Worth View: Stacked Assets vs Liabilities Area Chart
   */
  renderNetWorthAreaChart(container, historyRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const months = historyRows.map(r => r.month);
    const assets = historyRows.map(r => Math.round(r.assets / 1000));
    const liabilities = historyRows.map(r => Math.round(-r.liabilities / 1000));
    const netWorth = historyRows.map(r => Math.round(r.netWorth / 1000));

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Total Assets', 'Total Liabilities', 'Net Worth'],
        textStyle: { color: tokens.textColor },
        top: 5
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { color: tokens.textColor },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: tokens.textColor,
          formatter: (v) => `$${v.toLocaleString()}`
        },
        splitLine: { lineStyle: { color: tokens.splitLineColor } }
      },
      series: [
        {
          name: 'Total Assets',
          type: 'line',
          stack: 'balance',
          areaStyle: { opacity: 0.35, color: '#10b981' },
          lineStyle: { color: '#10b981', width: 2 },
          itemStyle: { color: '#10b981' },
          data: assets
        },
        {
          name: 'Total Liabilities',
          type: 'line',
          stack: 'balance',
          areaStyle: { opacity: 0.35, color: '#f43f5e' },
          lineStyle: { color: '#f43f5e', width: 2 },
          itemStyle: { color: '#f43f5e' },
          data: liabilities
        },
        {
          name: 'Net Worth',
          type: 'line',
          lineStyle: { color: '#38bdf8', width: 3 },
          itemStyle: { color: '#38bdf8' },
          data: netWorth
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Cash Flow View: Monthly Income vs Expense Comparative Bar + Cumulative Savings
   */
  renderMonthlyTrendsBar(container, monthlyRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const months = monthlyRows.map(r => r.month);
    const income = monthlyRows.map(r => Math.round(r.income / 1000));
    const expense = monthlyRows.map(r => Math.round(r.expense / 1000));

    let runningSavings = 0;
    const cumulativeSavings = monthlyRows.map(r => {
      runningSavings += Math.round((r.income - r.expense) / 1000);
      return runningSavings;
    });

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText }
      },
      legend: {
        data: ['Income', 'Expense', 'Cumulative Net Savings'],
        textStyle: { color: tokens.textColor },
        top: 5
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { color: tokens.textColor },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { color: tokens.textColor, formatter: '${value}' },
          splitLine: { lineStyle: { color: tokens.splitLineColor } }
        },
        {
          type: 'value',
          name: 'Cumulative ($)',
          axisLabel: { color: tokens.textColor, formatter: '${value}' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Income',
          type: 'bar',
          data: income,
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }
        },
        {
          name: 'Expense',
          type: 'bar',
          data: expense,
          itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] }
        },
        {
          name: 'Cumulative Net Savings',
          type: 'line',
          yAxisIndex: 1,
          data: cumulativeSavings,
          itemStyle: { color: '#6366f1' },
          lineStyle: { width: 3 }
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Net Worth View: Account Distribution Donut Chart
   */
  renderAccountDistributionDonut(container, distributionRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const data = distributionRows
      .filter(r => r.total_balance > 0)
      .map(r => ({
        name: r.category,
        value: Math.round(r.total_balance / 1000)
      }));

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'item',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        formatter: (params) => {
          return `<b>${params.name}</b><br/>$${params.value.toLocaleString()} (${params.percent}%)`;
        }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: tokens.textColor }
      },
      series: [
        {
          name: 'Account Distribution',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: tokens.isDark ? '#0f172a' : '#ffffff',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: tokens.titleColor
            }
          },
          data: data
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Budget View: 12-Month Category Spending Drift & Trend Analysis
   */
  renderCategoryTrendChart(container, trendRows, categoryName) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const months = trendRows.map(r => r.month);
    const amounts = trendRows.map(r => Math.round(r.spent / 1000));
    const avg = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        formatter: (params) => {
          const p = params[0];
          return `<b>${categoryName}</b><br/>${p.name}: <b>$${p.value.toLocaleString()}</b> (Avg: $${avg.toLocaleString()})`;
        }
      },
      grid: {
        left: '4%',
        right: '8%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { color: tokens.textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tokens.textColor, formatter: '${value}' },
        splitLine: { lineStyle: { color: tokens.splitLineColor } }
      },
      series: [
        {
          name: categoryName,
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: '#6366f1',
            borderRadius: [4, 4, 0, 0]
          },
          markLine: {
            data: [
              {
                yAxis: avg,
                name: 'Average Spend',
                lineStyle: { color: '#f59e0b', type: 'dashed', width: 2 },
                label: {
                  position: 'insideStartTop',
                  formatter: 'Avg Baseline: ${c}',
                  color: tokens.textColor,
                  fontSize: 10,
                  fontWeight: 600
                }
              }
            ]
          }
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Net Worth View: Debt Payoff Timeline (Snowball vs. Avalanche Curves)
   */
  renderDebtPayoffTimelineChart(container, snowballHistory, avalancheHistory) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const maxMonths = Math.max(
      snowballHistory?.length || 0,
      avalancheHistory?.length || 0
    );

    const labels = Array.from({ length: maxMonths }, (_, i) => `Mo ${i + 1}`);
    const snowballData = (snowballHistory || []).map(h => Math.round(h.remainingBalance / 1000));
    const avalancheData = (avalancheHistory || []).map(h => Math.round(h.remainingBalance / 1000));

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Snowball Method', 'Avalanche Method'],
        textStyle: { color: tokens.textColor },
        top: 5
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: tokens.textColor, interval: 'auto' },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tokens.textColor, formatter: '${value}' },
        splitLine: { lineStyle: { color: tokens.splitLineColor } }
      },
      series: [
        {
          name: 'Snowball Method',
          type: 'line',
          data: snowballData,
          lineStyle: { width: 3, color: '#6366f1' },
          itemStyle: { color: '#6366f1' },
          smooth: true
        },
        {
          name: 'Avalanche Method',
          type: 'line',
          data: avalancheData,
          lineStyle: { width: 3, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          smooth: true
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Cash Flow View: Income & Expense Waterfall Chart
   */
  renderCashFlowWaterfall(container, incomeDollars, groupItems, netSavingsDollars) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const categories = ['Total Income', ...groupItems.map(g => g.name), 'Net Savings'];
    const placeholder = [0];
    const values = [incomeDollars];

    let current = incomeDollars;
    for (const g of groupItems) {
      current -= g.amount;
      placeholder.push(Math.max(0, current));
      values.push(g.amount);
    }
    placeholder.push(0);
    values.push(Math.max(0, netSavingsDollars));

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        formatter: (params) => {
          const tar = params[1] || params[0];
          return `${tar.name}<br/><b>$${tar.value.toLocaleString()}</b>`;
        }
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '22%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: tokens.textColor,
          interval: 0,
          rotate: 25,
          fontSize: 10,
          margin: 12
        },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tokens.textColor, formatter: '${value}' },
        splitLine: { lineStyle: { color: tokens.splitLineColor } }
      },
      series: [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: placeholder
        },
        {
          name: 'Amount',
          type: 'bar',
          stack: 'Total',
          label: { show: true, position: 'top', color: tokens.textColor, fontSize: 10, formatter: '${c}' },
          itemStyle: {
            color: (params) => {
              if (params.dataIndex === 0) return '#10b981'; // Income (Green)
              if (params.dataIndex === categories.length - 1) return '#6366f1'; // Savings (Indigo)
              return '#f43f5e'; // Expense (Rose)
            },
            borderRadius: [4, 4, 0, 0]
          },
          data: values
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Day of Week Spending Breakdown (Sunday to Saturday)
   */
  renderDayOfWeekChart(container, dayRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    const days = dayRows.map(d => d.dayName);
    const amounts = dayRows.map(d => Math.round(d.totalSpent / 1000));
    const txCounts = dayRows.map(d => d.txCount);

    const maxAmt = Math.max(...amounts, 1);

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = params[0];
          const count = txCounts[p.dataIndex];
          return `<b>${p.name}</b><br/>Spent: <b>$${p.value.toLocaleString()}</b><br/>Transactions: <b>${count}</b>`;
        }
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '10%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: days,
        axisLabel: { color: tokens.textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tokens.textColor, formatter: '${value}' },
        splitLine: { lineStyle: { color: tokens.splitLineColor } }
      },
      series: [
        {
          name: 'Spent',
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: (params) => {
              // Highlight peak spending day with vibrant coral/rose
              return params.value === maxAmt ? '#f43f5e' : '#6366f1';
            },
            borderRadius: [6, 6, 0, 0]
          },
          label: {
            show: true,
            position: 'top',
            color: tokens.textColor,
            fontSize: 10,
            formatter: (v) => v.value > 0 ? `$${v.value}` : ''
          }
        }
      ]
    };

    chart.setOption(option, true);
  },

  /**
   * Month-over-Month Category Spending Variance Divergence Chart
   */
  renderCategoryVarianceChart(container, varianceRows) {
    const chart = this.getOrInitChart(container);
    if (!chart) return;
    const tokens = EChartsTheme.getTokens();

    // Top 8 spend increases and top 4 savings
    const topDrifts = [
      ...varianceRows.filter(r => r.diff > 0).slice(0, 7),
      ...varianceRows.filter(r => r.diff < 0).slice(-5)
    ].sort((a, b) => a.diff - b.diff);

    const names = topDrifts.map(r => r.name);
    const diffs = topDrifts.map(r => Math.round(r.diff / 1000));

    const option = {
      backgroundColor: tokens.backgroundColor,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipText },
        formatter: (params) => {
          const p = params[0];
          const item = topDrifts[p.dataIndex];
          const dir = p.value >= 0 ? 'Increase' : 'Reduction';
          return `<b>${p.name}</b> (${item.groupName})<br/>` +
            `Change: <b class="${p.value >= 0 ? 'text-rose-400' : 'text-emerald-400'}">${p.value >= 0 ? '+' : ''}$${p.value.toLocaleString()} (${item.pctChange > 0 ? '+' : ''}${item.pctChange}%)</b><br/>` +
            `Current: $${Math.round(item.currentSpent / 1000).toLocaleString()} | Prior: $${Math.round(item.previousSpent / 1000).toLocaleString()}`;
        }
      },
      grid: {
        left: '4%',
        right: '6%',
        bottom: '8%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: tokens.textColor, formatter: '${value}' },
        splitLine: { lineStyle: { color: tokens.splitLineColor } }
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: tokens.textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      series: [
        {
          name: 'Variance',
          type: 'bar',
          data: diffs,
          itemStyle: {
            color: (params) => params.value >= 0 ? '#f43f5e' : '#10b981',
            borderRadius: [4, 4, 4, 4]
          },
          label: {
            show: true,
            position: (params) => params.value >= 0 ? 'right' : 'left',
            color: tokens.textColor,
            fontSize: 10,
            formatter: (v) => `${v.value >= 0 ? '+' : ''}$${v.value}`
          }
        }
      ]
    };

    chart.setOption(option, true);
  }
};
