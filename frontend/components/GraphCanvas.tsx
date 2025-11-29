import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { GraphData, GraphNode, GraphLink, NodeType } from "../types";
import {
  Navigation,
  Sun,
  Moon,
  Search,
  X,
  Layers,
  MousePointer2,
  Hand,
} from "lucide-react";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onCreateGroup: (
    name: string,
    nodeIds: string[],
    initialPosition?: { x: number; y: number }
  ) => void;
  onUngroup: (
    node: GraphNode,
    groupPosition?: { x: number; y: number }
  ) => void;
  selectedNodeIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}


const getShortestPath = (
  startId: string,
  endId: string,
  links: GraphLink[]
): Set<string> => {
  if (startId === endId) return new Set([startId]);

  const adjacencyList = new Map<string, string[]>();


  links.forEach((link) => {
    const s =
      typeof link.source === "object" ? (link.source as any).id : link.source;
    const t =
      typeof link.target === "object" ? (link.target as any).id : link.target;

    if (!adjacencyList.has(s)) adjacencyList.set(s, []);
    adjacencyList.get(s)!.push(t);
  });

  
  const queue: [string, string[]][] = [[startId, [startId]]];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const [currentId, path] = queue.shift()!;

    if (currentId === endId) {
      return new Set(path);
    }

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }

  return new Set(); 
};

const GraphCanvas: React.FC<GraphCanvasProps> = ({
  data,
  onNodeClick,
  isDarkMode,
  onToggleTheme,
  onCreateGroup,
  onUngroup,
  selectedNodeIds,
  onSelectionChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  const [mode, setMode] = useState<"pan" | "select">("pan");


  const [goldenPathIds, setGoldenPathIds] = useState<Set<string>>(new Set());

  
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredNodes, setFilteredNodes] = useState<GraphNode[]>([]);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);


  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);


  const [showGroupInput, setShowGroupInput] = useState(false);
  const [groupName, setGroupName] = useState("");


  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g").attr("class", "graph-container");


    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "gold-gradient")
      .attr("gradientUnits", "userSpaceOnUse");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#F59E0B"); 
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#FCD34D"); 

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => event.type === "wheel" || mode === "pan")
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    const simulation = d3
      .forceSimulation<GraphNode, GraphLink>()
      .force("charge", d3.forceManyBody().strength(-800))
      .force("collide", d3.forceCollide().radius(80))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05));

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, []); 

  
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;

    zoom.filter((event) => event.type === "wheel" || mode === "pan");

    if (mode === "pan") {
      svg.style("cursor", "grab");
    } else {
      svg.style("cursor", "crosshair");
    }
  }, [mode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === "select") {
      const rect = svgRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      selectionStartRef.current = { x, y };
      setSelectionBox({ x, y, width: 0, height: 0 });
      if (!e.shiftKey) {
        onSelectionChange(new Set());
      }
    } else {
      setHighlightedNodeId(null);
    
      if (!e.shiftKey) {
        setGoldenPathIds(new Set());
        onSelectionChange(new Set());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === "select" && selectionStartRef.current) {
      const rect = svgRef.current!.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const startX = selectionStartRef.current.x;
      const startY = selectionStartRef.current.y;

      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      setSelectionBox({ x, y, width, height });
    }
  };

  const handleMouseUp = () => {
    if (mode === "select" && selectionBox && simulationRef.current) {
      const transform = transformRef.current;
      const nodes = simulationRef.current.nodes();
      const newSelected = new Set(selectedNodeIds);

      nodes.forEach((node) => {
        if (node.x !== undefined && node.y !== undefined) {
          const screenX = transform.x + node.x * transform.k;
          const screenY = transform.y + node.y * transform.k;

          if (
            screenX >= selectionBox.x &&
            screenX <= selectionBox.x + selectionBox.width &&
            screenY >= selectionBox.y &&
            screenY <= selectionBox.y + selectionBox.height
          ) {
            newSelected.add(node.id);
          }
        }
      });

      onSelectionChange(newSelected);
      setSelectionBox(null);
      selectionStartRef.current = null;
    }
  };


  useEffect(() => {
    if (!simulationRef.current || !svgRef.current) return;

    const simulation = simulationRef.current;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>(".graph-container");

    const currentNodes = simulation.nodes();

    const newNodes = data.nodes.map((n) => {
      const existing = currentNodes.find((en) => en.id === n.id);
      if (existing) {
        return { ...existing, text: n.text };
      }
      const parent = currentNodes.find((en) => en.id === n.parentId);
      if (parent) {
        return { ...n, x: parent.x, y: parent.y };
      }
      return n;
    });

    simulation.nodes(newNodes);

    const safeLinks = data.links.map((l) => ({
      ...l,
      source:
        typeof l.source === "object" ? (l.source as GraphNode).id : l.source,
      target:
        typeof l.target === "object" ? (l.target as GraphNode).id : l.target,
    }));

    simulation.force(
      "link",
      d3
        .forceLink<GraphNode, GraphLink>(safeLinks)
        .id((d) => d.id)
        .distance(150)
    );

    simulation.alpha(1).restart();

  
    const drag = d3
      .drag<SVGForeignObjectElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        const target = event.sourceEvent.target as Element;
        const fo = target.closest(
          "foreignObject"
        ) as unknown as HTMLElement | null;
        if (fo) fo.style.cursor = "grabbing";
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        const target = event.sourceEvent.target as Element;
        const fo = target.closest(
          "foreignObject"
        ) as unknown as HTMLElement | null;
        if (fo) fo.style.cursor = "grab";
      });


    let selectionPreview = g.select<SVGRectElement>(".selection-preview");
    if (selectionPreview.empty()) {
      selectionPreview = g
        .insert("rect", ":first-child")
        .attr(
          "class",
          "selection-preview fill-blue-500/5 stroke-blue-500/50 dark:fill-blue-400/10 dark:stroke-blue-400/60 pointer-events-none transition-all duration-300"
        )
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,4")
        .attr("rx", 24)
        .style("display", "none");
    }


    const link = g
      .selectAll<SVGLineElement, GraphLink>(".link")
      .data(safeLinks, (d) => {
        const s =
          typeof d.source === "object" ? (d.source as GraphNode).id : d.source;
        const t =
          typeof d.target === "object" ? (d.target as GraphNode).id : d.target;
        return `${s}-${t}`;
      });

    link.exit().remove();

    const linkEnter = link
      .enter()
      .append("line")
      .attr("class", "link transition-all duration-500 ease-in-out") 
      .attr("stroke-opacity", 0.6);

    const allLinks = linkEnter.merge(link);


    allLinks.each(function (d) {
      const s =
        typeof d.source === "object"
          ? (d.source as GraphNode).id
          : (d.source as string);
      const t =
        typeof d.target === "object"
          ? (d.target as GraphNode).id
          : (d.target as string);

      
      const isGolden = goldenPathIds.has(s) && goldenPathIds.has(t);

      const el = d3.select(this);

      if (isGolden) {
        el.attr("stroke", "url(#gold-gradient)")
          .attr("stroke", "#F59E0B")
          .attr("stroke-width", 4)
          .attr("stroke-opacity", 1)
          .raise(); 
      } else {
        el.attr("stroke", null) 
          .classed("stroke-zinc-300 dark:stroke-zinc-600", true)
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.6);
      }
    });


    const node = g
      .selectAll<SVGForeignObjectElement, GraphNode>(".node")
      .data(newNodes, (d) => d.id);

    node.exit().transition().duration(300).attr("opacity", 0).remove();

    const nodeEnter = node
      .enter()
      .append("foreignObject")
      .attr("class", "node")
      .attr("width", 160)
      .attr("height", 160)
      .attr("overflow", "visible")
      .call(drag as any);

    nodeEnter
      .append("xhtml:div")
      .style("width", "100%")
      .style("height", "100%")
      .style("display", "flex")
      .style("justify-content", "center")
      .style("align-items", "center");

    const allNodes = nodeEnter.merge(node);

    allNodes.select("div").html((d) => {
      const isSelected = selectedNodeIds.has(d.id);
      const isHighlighted = d.id === highlightedNodeId;
      const isGolden = goldenPathIds.has(d.id); 
      const isGroup = d.type === NodeType.GROUP;

     
      let ringClass = "";

    
      if (isGolden) {
       
        ringClass =
          "ring-4 ring-offset-2 ring-amber-400 dark:ring-amber-500 ring-offset-zinc-50 dark:ring-offset-zinc-950 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.5)]";
      } else if (isSelected) {
        ringClass =
          "ring-4 ring-offset-2 ring-green-500 dark:ring-green-400 ring-offset-zinc-50 dark:ring-offset-zinc-950 scale-105";
      } else if (isHighlighted) {
        ringClass =
          "ring-4 ring-offset-2 ring-blue-500 dark:ring-blue-400 ring-offset-zinc-50 dark:ring-offset-zinc-950 scale-110";
      }

      let bgClass = "";
      let iconHtml = "";

      if (d.type === NodeType.QUERY) {
        bgClass =
          "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-white text-zinc-900 dark:text-white dark:shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10";
      } else if (d.type === NodeType.ANSWER) {
        bgClass =
          "bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-200 z-20";
      } else if (d.type === NodeType.OPTION) {
        bgClass =
          "bg-white dark:bg-black border-dashed border-zinc-400 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 cursor-pointer z-30";
      } else if (d.type === NodeType.GROUP) {
        bgClass =
          "bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-500 dark:border-zinc-400 text-zinc-900 dark:text-white z-40";
        iconHtml =
          '<div class="mb-1 text-blue-600 dark:text-blue-400"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg></div>';
      }

      const expandButton = isGroup
        ? `<button class="expand-btn mt-1.5 flex items-center gap-1 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all shadow-sm pointer-events-auto text-zinc-700 dark:text-zinc-300">
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
               Expand
             </button>`
        : "";

      return `
        <div class="
          node-inner-div
          w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center p-4 text-center text-xs transition-all duration-300 border-2 shadow-lg
          ${ringClass}
          ${bgClass}
          ${d.isExpanded ? "opacity-50 pointer-events-none" : ""}
        ">
          ${iconHtml}
          <span class="line-clamp-2 leading-tight pointer-events-none select-none font-medium">${
            d.text
          }</span>
          ${expandButton}
        </div>
      `;
    });


    allNodes
      .select("div")
      .on("click", (event, d) => {
        event.stopPropagation();

        if ((event.target as HTMLElement).closest(".expand-btn")) {
          if (d.type === NodeType.GROUP) {
            onUngroup(d, { x: d.x!, y: d.y! });
          }
          return;
        }

        if (d.type === NodeType.GROUP) {
          setHighlightedNodeId(d.id);
          if (mode === "select") {
            const newSet = new Set(selectedNodeIds);
            newSet.add(d.id);
            onSelectionChange(newSet);
          }
          return;
        }

        if (event.shiftKey) {
          const newSet = new Set(selectedNodeIds);
          if (newSet.has(d.id)) newSet.delete(d.id);
          else newSet.add(d.id);
          onSelectionChange(newSet);
        } else {
         
          if (mode === "pan") {
       
            const rootId = data.nodes[0]?.id;

            if (rootId) {
              const path = getShortestPath(rootId, d.id, data.links);
              setGoldenPathIds(path);
            }

            if (d.type === NodeType.OPTION && !d.isExpanded) {
              onNodeClick(d);
            } else {
              setHighlightedNodeId(d.id);
            }
          } else {
            const newSet = new Set(selectedNodeIds);
            newSet.add(d.id);
            onSelectionChange(newSet);
          }
        }
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        if (d.type === NodeType.GROUP) {
          onUngroup(d, { x: d.x!, y: d.y! });
        }
      })
      .on("mouseenter", (event, d) => {
        setTooltip({ text: d.text, x: event.clientX, y: event.clientY });
      })
      .on("mousemove", (event, d) => {
        setTooltip({ text: d.text, x: event.clientX, y: event.clientY });
      })
      .on("mouseleave", () => {
        setTooltip(null);
      });

   
    simulation.on("tick", () => {
      allLinks
        .attr("x1", (d) => (d.source as unknown as GraphNode).x!)
        .attr("y1", (d) => (d.source as unknown as GraphNode).y!)
        .attr("x2", (d) => (d.target as unknown as GraphNode).x!)
        .attr("y2", (d) => (d.target as unknown as GraphNode).y!);

      allNodes.attr("x", (d) => d.x! - 80).attr("y", (d) => d.y! - 80);

      if (selectedNodeIds.size > 1) {
        const selectedNodesData = newNodes.filter((n) =>
          selectedNodeIds.has(n.id)
        );
        if (selectedNodesData.length > 1) {
          const xs = selectedNodesData.map((d) => d.x || 0);
          const ys = selectedNodesData.map((d) => d.y || 0);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const padding = 85;

          selectionPreview
            .attr("x", minX - padding)
            .attr("y", minY - padding)
            .attr("width", maxX - minX + padding * 2)
            .attr("height", maxY - minY + padding * 2)
            .style("display", "block");
        } else {
          selectionPreview.style("display", "none");
        }
      } else {
        selectionPreview.style("display", "none");
      }
    });
  }, [
    data,
    onNodeClick,
    isDarkMode,
    highlightedNodeId,
    selectedNodeIds,
    goldenPathIds,
    mode,
    onSelectionChange,
  ]);

 
  const handleRecenter = () => {
    if (!svgRef.current || !containerRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    svg
      .transition()
      .duration(750)
      .call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(0, 0).scale(1)
      );

    simulationRef.current?.alpha(0.5).restart();
    if (simulationRef.current) {
      simulationRef.current.force(
        "center",
        d3.forceCenter(width / 2, height / 2).strength(0.1)
      );
    }
  };


  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredNodes([]);
      return;
    }
    const lower = searchQuery.toLowerCase();
    const matches = data.nodes.filter((n) =>
      n.text.toLowerCase().includes(lower)
    );
    setFilteredNodes(matches);
  }, [searchQuery, data.nodes]);

  const handleSearchSelect = (nodeId: string) => {
    const node = simulationRef.current?.nodes().find((n) => n.id === nodeId);
    if (!node || !svgRef.current || !containerRef.current || !zoomRef.current)
      return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const scale = 1.5;

    const svg = d3.select(svgRef.current);
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-node.x!, -node.y!);

    svg.transition().duration(1000).call(zoomRef.current.transform, transform);

    setHighlightedNodeId(nodeId);
    setSearchQuery("");
    setFilteredNodes([]);
    setIsSearchFocused(false);
  };

  const submitGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (groupName.trim()) {
      const currentD3Nodes = simulationRef.current?.nodes() || [];
      const selectedD3Nodes = currentD3Nodes.filter((n) =>
        selectedNodeIds.has(n.id)
      );

      let x = 0,
        y = 0;
      if (selectedD3Nodes.length > 0) {
        x =
          selectedD3Nodes.reduce((sum, n) => sum + (n.x || 0), 0) /
          selectedD3Nodes.length;
        y =
          selectedD3Nodes.reduce((sum, n) => sum + (n.y || 0), 0) /
          selectedD3Nodes.length;
      }

      onCreateGroup(groupName, Array.from(selectedNodeIds), { x, y });
      setGroupName("");
      setShowGroupInput(false);
    }
  };

 
  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <svg ref={svgRef} className="w-full h-full block touch-none" />

     
      {tooltip && (
        <div
          className="fixed z-[100] bg-zinc-900/90 dark:bg-zinc-100/90 text-zinc-100 dark:text-zinc-900 text-xs p-3 rounded-lg shadow-xl max-w-xs pointer-events-none border border-zinc-700 dark:border-zinc-200 backdrop-blur-sm transition-opacity duration-200"
          style={{
            left: Math.min(tooltip.x + 15, window.innerWidth - 320),
            top: Math.min(tooltip.y + 15, window.innerHeight - 100),
          }}
        >
          {tooltip.text}
        </div>
      )}

   
      {selectionBox && (
        <div
          className="absolute border border-green-500 bg-green-500/20 pointer-events-none"
          style={{
            left: selectionBox.x,
            top: selectionBox.y,
            width: selectionBox.width,
            height: selectionBox.height,
          }}
        />
      )}


      <div className="absolute top-4 left-4 z-50">
        <div
          className={`flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm transition-all duration-300 ${
            isSearchFocused || searchQuery
              ? "w-64 ring-2 ring-blue-500/20"
              : "w-10 md:w-64"
          }`}
        >
          <div className="p-2 text-zinc-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            placeholder="Search nodes..."
            className={`bg-transparent border-none outline-none text-sm text-zinc-800 dark:text-zinc-200 h-10 w-full pr-2 ${
              isSearchFocused || searchQuery
                ? "opacity-100"
                : "opacity-0 md:opacity-100 w-0 md:w-full"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {filteredNodes.length > 0 && (isSearchFocused || searchQuery) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
            {filteredNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => handleSearchSelect(node.id)}
                className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0"
              >
                <div className="font-medium mb-0.5 truncate">{node.text}</div>
                <div className="text-[10px] text-zinc-400 uppercase">
                  {node.type}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
        <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm overflow-hidden p-1 gap-1">
          <button
            onClick={() => setMode("pan")}
            className={`p-1.5 rounded-md transition-colors ${
              mode === "pan"
                ? "bg-zinc-100 dark:bg-zinc-700 text-blue-500"
                : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
            title="Pan Mode (Hand)"
          >
            <Hand size={18} />
          </button>
          <button
            onClick={() => setMode("select")}
            className={`p-1.5 rounded-md transition-colors ${
              mode === "select"
                ? "bg-zinc-100 dark:bg-zinc-700 text-blue-500"
                : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
            title="Select Mode (Box)"
          >
            <MousePointer2 size={18} />
          </button>
        </div>
        <button
          onClick={onToggleTheme}
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          onClick={handleRecenter}
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm"
        >
          <Navigation size={20} />
        </button>
      </div>

     
      {selectedNodeIds.size > 1 && !showGroupInput && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setShowGroupInput(true)}
            className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium text-sm hover:scale-105 transition-transform"
          >
            <Layers size={16} />
            <span>Group {selectedNodeIds.size} nodes</span>
          </button>
        </div>
      )}

    
      {showGroupInput && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl w-80 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">
              Name this area
            </h3>
            <form onSubmit={submitGroup}>
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Python Basics"
                className="w-full px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border-none outline-none focus:ring-2 ring-blue-500 mb-4 text-zinc-900 dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGroupInput(false)}
                  className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!groupName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-xs text-zinc-400 dark:text-zinc-600 pointer-events-none select-none">
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
};

export default GraphCanvas;
