import React, { useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import GraphCanvas from "./components/GraphCanvas";
import InputBar from "./components/InputBar";
import { fetchGeminiResponseApi } from "./services/geminiService";
import { GraphData, GraphNode, NodeType, GraphLink } from "./types";
import { AlertCircle } from "lucide-react";

const App: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set()
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawData = params.get("report");

    if (rawData) {
      try {
        const reportData: any = JSON.parse(decodeURIComponent(rawData));

    
        const centerNodeId = uuidv4();
        const centerNode: GraphNode = {
          id: centerNodeId,
          
          type: NodeType.ANSWER,
         
          text: `[${reportData.verdict}] ${reportData.summary}`,
          parentId: undefined,
        };

       
        const surroundingNodes: GraphNode[] = (
          reportData.follow_up_questions || []
        ).map((question) => ({
          id: uuidv4(),
          type: NodeType.OPTION,
          text: question,
          parentId: centerNodeId,
          isExpanded: false,
        }));

        
        const links = surroundingNodes.map((node) => ({
          source: centerNodeId,
          target: node.id,
        }));

        
        setGraphData({
          nodes: [centerNode, ...surroundingNodes],
          links: links,
        });
      } catch (e) {
        console.error("Failed to parse report data", e);
        setError(
          "Failed to load the report. The data format might be invalid."
        );
      }
    }
  }, []);
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  
  const hasKey = !!process.env.API_KEY;

  const handleInteraction = useCallback(
    async (query: string, parentNodeId?: string) => {
      setIsLoading(true);
      setError(null);

      
      let selectionContext = "";
      if (selectedNodeIds.size > 0 && !parentNodeId) {
        const selectedNodes = graphData.nodes.filter((n) =>
          selectedNodeIds.has(n.id)
        );
        if (selectedNodes.length > 0) {
          const nodeTexts = selectedNodes.map((n) => `"${n.text}"`).join(", ");
          selectionContext = `The user is explicitly asking about these specific nodes/topics: [${nodeTexts}]. Ensure the response relates directly to them.`;
        }
      }

      const queryNodeId = uuidv4();
      const queryNode: GraphNode = {
        id: queryNodeId,
        type: NodeType.QUERY,
        text: query,
        parentId: parentNodeId,
      };

      setGraphData((prev) => ({
        nodes: [...prev.nodes, queryNode],
        links: parentNodeId
          ? [...prev.links, { source: parentNodeId, target: queryNodeId }]
          : prev.links,
      }));

      try {

        let baseContext = parentNodeId
          ? "User is exploring a specific branch of the previous topic."
          : "Start of conversation.";
        if (selectionContext) {
          baseContext += `\n\n${selectionContext}`;
        }
        const aiResponse = await fetchGeminiResponseApi(query, baseContext);
        console.log("AI Response:", aiResponse);
        
        const answerNodeId = uuidv4();
        const answerNode: GraphNode = {
          id: answerNodeId,
          type: NodeType.ANSWER,
          text: aiResponse.answer,
          parentId: queryNodeId,
        };

     
        const optionNodes: GraphNode[] = aiResponse.follow_up_queries.map(
          (opt) => ({
            id: uuidv4(),
            type: NodeType.OPTION,
            text: opt,
            parentId: answerNodeId,
            isExpanded: false,
          })
        );

        
        setGraphData((prev) => {
          const newNodes = [answerNode, ...optionNodes];
          const newLinks = [
            { source: queryNodeId, target: answerNodeId },
            ...optionNodes.map((opt) => ({
              source: answerNodeId,
              target: opt.id,
            })),
          ];

          return {
            nodes: [...prev.nodes, ...newNodes],
            links: [...prev.links, ...newLinks],
          };
        });

        
      } catch (err) {
        console.error(err);
        setError("Failed to generate response. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [graphData.nodes, selectedNodeIds]
  );

  const handleSendMessage = (message: string) => {
    handleInteraction(message);
  };

  const handleNodeClick = (node: GraphNode) => {
    if (node.type === NodeType.OPTION && !node.isExpanded && !isLoading) {
    
      setGraphData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === node.id ? { ...n, isExpanded: true } : n
        ),
      }));

      handleInteraction(node.text, node.id);
    }
  };

  const handleRenameNode = (nodeId: string, newName: string) => {
    setGraphData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, text: newName } : n
      ),
    }));
  };


  const getLinkId = (item: string | GraphNode) =>
    typeof item === "object" ? item.id : item;

  const handleCreateGroup = (
    name: string,
    nodeIds: string[],
    initialPosition?: { x: number; y: number }
  ) => {
    if (nodeIds.length === 0) return;

    setGraphData((prev) => {
      const selectedNodes = prev.nodes.filter((n) => nodeIds.includes(n.id));
      const remainingNodes = prev.nodes.filter((n) => !nodeIds.includes(n.id));

   
      const groupX = initialPosition?.x ?? 0;
      const groupY = initialPosition?.y ?? 0;

      
      const internalLinks: GraphLink[] = [];
      const externalLinks: GraphLink[] = [];
      const keptLinks: GraphLink[] = [];
      const newGroupLinks: GraphLink[] = [];

      const groupNodeId = uuidv4();

      prev.links.forEach((link) => {
        const sourceId = getLinkId(link.source);
        const targetId = getLinkId(link.target);

        const sourceSelected = nodeIds.includes(sourceId);
        const targetSelected = nodeIds.includes(targetId);

       
        const cleanLink = { ...link, source: sourceId, target: targetId };

        if (sourceSelected && targetSelected) {
          internalLinks.push(cleanLink);
        } else if (sourceSelected) {
          externalLinks.push(cleanLink);
          newGroupLinks.push({ source: groupNodeId, target: targetId });
        } else if (targetSelected) {
          externalLinks.push(cleanLink);
          newGroupLinks.push({ source: sourceId, target: groupNodeId });
        } else {
          keptLinks.push(cleanLink);
        }
      });

      const groupNode: GraphNode = {
        id: groupNodeId,
        type: NodeType.GROUP,
        text: name,
        x: groupX,
        y: groupY,
        groupData: {
          nodes: selectedNodes,
          internalLinks,
          externalLinks,
        },
      };

      return {
        nodes: [...remainingNodes, groupNode],
        links: [...keptLinks, ...newGroupLinks],
      };
    });
   
    setSelectedNodeIds(new Set());
  };

  const handleUngroupNode = (
    groupNode: GraphNode,
    groupPosition?: { x: number; y: number }
  ) => {
    if (!groupNode.groupData) return;

    setGraphData((prev) => {
  
      const remainingNodes = prev.nodes.filter((n) => n.id !== groupNode.id);

      const originX = groupPosition?.x ?? (groupNode.x || 0);
      const originY = groupPosition?.y ?? (groupNode.y || 0);

      const restoredNodes = groupNode.groupData!.nodes.map((n) => ({
        ...n,
     
        x: originX + (Math.random() * 60 - 30),
        y: originY + (Math.random() * 60 - 30),
        fx: null,
        fy: null,
      }));

    
      const keptLinks = prev.links
        .filter((link) => {
          const sourceId = getLinkId(link.source);
          const targetId = getLinkId(link.target);
          return sourceId !== groupNode.id && targetId !== groupNode.id;
        })
        .map((l) => ({
          ...l,
          source: getLinkId(l.source),
          target: getLinkId(l.target),
        }));

 
      const restoredLinks = [
        ...groupNode.groupData!.internalLinks,
        ...groupNode.groupData!.externalLinks,
      ].map((link) => ({
        ...link,
        source: getLinkId(link.source),
        target: getLinkId(link.target),
      }));

      return {
        nodes: [...remainingNodes, ...restoredNodes],
        links: [...keptLinks, ...restoredLinks],
      };
    });
  };

  return (
    <div className="w-screen h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col relative overflow-hidden font-sans transition-colors duration-300">
      {!hasKey && (
        <div className="absolute top-0 left-0 right-0 bg-red-900/50 text-red-200 text-xs p-2 text-center z-[100] flex items-center justify-center gap-2">
          <AlertCircle size={14} />
          <span>
            Missing API Key. Responses will be simulated after a delay. Set
            process.env.API_KEY to use Gemini.
          </span>
        </div>
      )}

     
      <div className="flex-1 w-full h-full">
        <GraphCanvas
          data={graphData}
          onNodeClick={handleNodeClick}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          onCreateGroup={handleCreateGroup}
          onUngroup={handleUngroupNode}
          selectedNodeIds={selectedNodeIds}
          onSelectionChange={setSelectedNodeIds}
        />
      </div>

    
      <InputBar
        onSend={handleSendMessage}
        isLoading={isLoading}
        selectedNodeCount={selectedNodeIds.size}
        onClearSelection={() => setSelectedNodeIds(new Set())}
      />

      
      {graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="text-center select-none">
            <h1 className="text-4xl font-bold tracking-tighter mb-4 text-zinc-400 dark:text-zinc-600 transition-colors">
              GraphMind
            </h1>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Explore ideas non-linearly
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default App;
