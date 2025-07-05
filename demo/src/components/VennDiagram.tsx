import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { MetamemoryThread } from '../types'
import './VennDiagram.scss'

interface VennDiagramProps {
  threads: MetamemoryThread[]
}

export default function VennDiagram({ threads }: VennDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || threads.length === 0) return

    const width = 300
    const height = 250
    const margin = 20

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`)

    const colors = d3.scaleOrdinal(d3.schemeCategory10)

    const calculateCirclePositions = (count: number) => {
      const positions: Array<{ x: number; y: number; r: number }> = []
      const baseRadius = Math.min(width, height) / 4
      
      if (count === 1) {
        positions.push({ x: 0, y: 0, r: baseRadius })
      } else if (count === 2) {
        const offset = baseRadius * 0.5
        positions.push({ x: -offset, y: 0, r: baseRadius })
        positions.push({ x: offset, y: 0, r: baseRadius })
      } else if (count === 3) {
        const angleStep = (2 * Math.PI) / 3
        for (let i = 0; i < 3; i++) {
          const angle = i * angleStep - Math.PI / 2
          positions.push({
            x: Math.cos(angle) * baseRadius * 0.7,
            y: Math.sin(angle) * baseRadius * 0.7,
            r: baseRadius * 0.8
          })
        }
      } else {
        const angleStep = (2 * Math.PI) / count
        for (let i = 0; i < count; i++) {
          const angle = i * angleStep
          positions.push({
            x: Math.cos(angle) * baseRadius,
            y: Math.sin(angle) * baseRadius,
            r: baseRadius * 0.6
          })
        }
      }
      
      return positions
    }

    const positions = calculateCirclePositions(threads.length)

    g.selectAll('circle')
      .data(threads)
      .enter()
      .append('circle')
      .attr('cx', (_, i) => positions[i].x)
      .attr('cy', (_, i) => positions[i].y)
      .attr('r', (_, i) => positions[i].r)
      .attr('fill', (_, i) => colors(i.toString()))
      .attr('fill-opacity', 0.3)
      .attr('stroke', (_, i) => colors(i.toString()))
      .attr('stroke-width', 2)

    g.selectAll('text.label')
      .data(threads)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', (_, i) => positions[i].x)
      .attr('y', (_, i) => positions[i].y - positions[i].r - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text(d => d.name)

    g.selectAll('text.size')
      .data(threads)
      .enter()
      .append('text')
      .attr('class', 'size')
      .attr('x', (_, i) => positions[i].x)
      .attr('y', (_, i) => positions[i].y)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .text(d => d.size)

    threads.forEach((thread, i) => {
      if (thread.overlap.size > 0) {
        thread.overlap.forEach(overlapId => {
          const overlapIndex = threads.findIndex(t => t.id === overlapId)
          if (overlapIndex !== -1 && overlapIndex > i) {
            const x1 = positions[i].x
            const y1 = positions[i].y
            const x2 = positions[overlapIndex].x
            const y2 = positions[overlapIndex].y
            
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2

            g.append('line')
              .attr('x1', x1)
              .attr('y1', y1)
              .attr('x2', x2)
              .attr('y2', y2)
              .attr('stroke', '#60a5fa')
              .attr('stroke-width', 1)
              .attr('stroke-dasharray', '5,5')
              .attr('opacity', 0.5)

            const sharedCount = threads[i].messages.filter(msg => 
              threads[overlapIndex].messages.some(m => m.id === msg.id)
            ).length

            if (sharedCount > 0) {
              g.append('text')
                .attr('x', midX)
                .attr('y', midY)
                .attr('text-anchor', 'middle')
                .attr('fill', '#60a5fa')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('class', 'overlap-count')
                .text(sharedCount)
                .attr('dy', -5)
            }
          }
        })
      }
    })

    const legend = svg.append('g')
      .attr('transform', `translate(${margin}, ${height - margin - threads.length * 15})`)

    threads.forEach((thread, i) => {
      const legendItem = legend.append('g')
        .attr('transform', `translate(0, ${i * 15})`)

      legendItem.append('circle')
        .attr('r', 5)
        .attr('fill', colors(i.toString()))

      legendItem.append('text')
        .attr('x', 10)
        .attr('y', 5)
        .attr('font-size', '10px')
        .attr('fill', 'white')
        .text(`${thread.name} (${thread.size})`)
    })

  }, [threads])

  return (
    <div className="venn-diagram">
      <svg ref={svgRef}></svg>
      <div className="diagram-info">
        <p className="text-xs text-gray-400">
          Circle size represents thread message count. 
          Dashed lines show overlapping threads with shared message count.
        </p>
      </div>
    </div>
  )
}