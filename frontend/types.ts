export enum NodeType {
  QUERY = 'QUERY',
  ANSWER = 'ANSWER',
  OPTION = 'OPTION',
  GROUP = 'GROUP'
}

export interface GraphNode {
  id: string;
  type: NodeType;
  text: string;
  x?: number;
  y?: number;
  fx?: number | null; 
  fy?: number | null; 
  parentId?: string;
  isExpanded?: boolean; 
  groupData?: GroupData;
}

export interface GraphLink {
  source: string | GraphNode; 
  target: string | GraphNode;
}

export interface GroupData {
  nodes: GraphNode[];
  internalLinks: GraphLink[];
  externalLinks: GraphLink[]; 
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GeminiResponse {
  answer: string;
  follow_up_queries: string[];
}