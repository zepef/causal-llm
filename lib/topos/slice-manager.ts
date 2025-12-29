// DEMOCRITUS - Topos Slice Manager
// Computes domain slices and functorial mappings between them

import type {
  CausalNode,
  CausalEdge,
  ToposSlice,
  SliceMorphism,
  SliceFunctor,
  CrossDomainAnalogy,
  RelationType,
} from '@/types/graph';
import { CausalGraph } from '@/lib/graph/CausalGraph';

/**
 * Manages topos slices and computes cross-domain functors
 */
export class SliceManager {
  private graph: CausalGraph;
  private slices: Map<string, ToposSlice> = new Map();

  constructor(graph: CausalGraph) {
    this.graph = graph;
  }

  /**
   * Compute all domain slices from the graph
   */
  computeSlices(): ToposSlice[] {
    const nodes = this.graph.getAllNodes();
    const edges = this.graph.getAllEdges();

    // Group nodes by domain
    const domainMap = new Map<string, Set<string>>();
    for (const node of nodes) {
      const domain = node.domain || 'default';
      if (!domainMap.has(domain)) {
        domainMap.set(domain, new Set());
      }
      domainMap.get(domain)!.add(node.id);
    }

    // Create slices
    const slices: ToposSlice[] = [];
    for (const [domain, nodeIds] of domainMap) {
      // Get internal morphisms (edges where both endpoints are in this slice)
      const morphisms: SliceMorphism[] = edges
        .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          relationType: e.relationType,
        }));

      const slice: ToposSlice = {
        id: domain,
        domain,
        objects: nodeIds,
        morphisms,
      };

      slices.push(slice);
      this.slices.set(domain, slice);
    }

    return slices;
  }

  /**
   * Compute functor between two slices based on structural similarity
   */
  computeFunctor(sourceSlice: ToposSlice, targetSlice: ToposSlice): SliceFunctor {
    const objectMap = new Map<string, string>();
    const morphismMap = new Map<string, string>();

    // Get nodes for each slice
    const sourceNodes = Array.from(sourceSlice.objects).map((id) => this.graph.getNode(id)).filter(Boolean) as CausalNode[];
    const targetNodes = Array.from(targetSlice.objects).map((id) => this.graph.getNode(id)).filter(Boolean) as CausalNode[];

    // Compute node similarity based on structural role
    const sourceNodeFeatures = this.computeNodeFeatures(sourceNodes, sourceSlice.morphisms);
    const targetNodeFeatures = this.computeNodeFeatures(targetNodes, targetSlice.morphisms);

    // Match nodes using Hungarian-like greedy assignment
    const usedTargets = new Set<string>();
    for (const [sourceId, sourceFeature] of sourceNodeFeatures) {
      let bestMatch: string | null = null;
      let bestSimilarity = -1;

      for (const [targetId, targetFeature] of targetNodeFeatures) {
        if (usedTargets.has(targetId)) continue;

        const similarity = this.computeFeatureSimilarity(sourceFeature, targetFeature);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = targetId;
        }
      }

      if (bestMatch && bestSimilarity > 0.3) {
        objectMap.set(sourceId, bestMatch);
        usedTargets.add(bestMatch);
      }
    }

    // Map morphisms based on object mapping
    for (const sourceMorphism of sourceSlice.morphisms) {
      const mappedSource = objectMap.get(sourceMorphism.source);
      const mappedTarget = objectMap.get(sourceMorphism.target);

      if (mappedSource && mappedTarget) {
        // Find corresponding morphism in target slice
        const correspondingMorphism = targetSlice.morphisms.find(
          (m) =>
            m.source === mappedSource &&
            m.target === mappedTarget &&
            m.relationType === sourceMorphism.relationType
        );

        if (correspondingMorphism) {
          morphismMap.set(sourceMorphism.id, correspondingMorphism.id);
        }
      }
    }

    // Calculate overall similarity
    const objectCoverage = objectMap.size / Math.max(sourceSlice.objects.size, 1);
    const morphismCoverage = morphismMap.size / Math.max(sourceSlice.morphisms.length, 1);
    const similarity = (objectCoverage + morphismCoverage) / 2;

    return {
      sourceSliceId: sourceSlice.id,
      targetSliceId: targetSlice.id,
      objectMap,
      morphismMap,
      similarity,
    };
  }

  /**
   * Find all cross-domain analogies
   */
  findAnalogies(minSimilarity = 0.2): CrossDomainAnalogy[] {
    const slices = Array.from(this.slices.values());
    const analogies: CrossDomainAnalogy[] = [];

    for (let i = 0; i < slices.length; i++) {
      for (let j = i + 1; j < slices.length; j++) {
        const sourceSlice = slices[i];
        const targetSlice = slices[j];

        const functor = this.computeFunctor(sourceSlice, targetSlice);

        if (functor.similarity >= minSimilarity) {
          // Build analogous pairs with similarity scores
          const analogousPairs: CrossDomainAnalogy['analogousPairs'] = [];

          for (const [sourceId, targetId] of functor.objectMap) {
            const sourceNode = this.graph.getNode(sourceId);
            const targetNode = this.graph.getNode(targetId);

            if (sourceNode && targetNode) {
              analogousPairs.push({
                sourceConcept: sourceNode.label,
                targetConcept: targetNode.label,
                similarity: this.computeConceptSimilarity(sourceNode, targetNode, sourceSlice, targetSlice),
              });
            }
          }

          analogies.push({
            sourceSlice,
            targetSlice,
            functor,
            analogousPairs: analogousPairs.sort((a, b) => b.similarity - a.similarity),
          });
        }
      }
    }

    return analogies.sort((a, b) => b.functor.similarity - a.functor.similarity);
  }

  /**
   * Compute structural features for a node
   */
  private computeNodeFeatures(
    nodes: CausalNode[],
    morphisms: SliceMorphism[]
  ): Map<string, NodeFeature> {
    const features = new Map<string, NodeFeature>();

    for (const node of nodes) {
      const inDegree = morphisms.filter((m) => m.target === node.id).length;
      const outDegree = morphisms.filter((m) => m.source === node.id).length;

      // Count relation types
      const inRelationTypes = new Map<RelationType, number>();
      const outRelationTypes = new Map<RelationType, number>();

      for (const m of morphisms) {
        if (m.target === node.id) {
          inRelationTypes.set(m.relationType, (inRelationTypes.get(m.relationType) || 0) + 1);
        }
        if (m.source === node.id) {
          outRelationTypes.set(m.relationType, (outRelationTypes.get(m.relationType) || 0) + 1);
        }
      }

      features.set(node.id, {
        inDegree,
        outDegree,
        totalDegree: inDegree + outDegree,
        inRelationTypes,
        outRelationTypes,
        isHub: inDegree + outDegree > 3,
        isSource: inDegree === 0 && outDegree > 0,
        isSink: outDegree === 0 && inDegree > 0,
      });
    }

    return features;
  }

  /**
   * Compute similarity between two node features
   */
  private computeFeatureSimilarity(f1: NodeFeature, f2: NodeFeature): number {
    // Degree similarity
    const maxDegree = Math.max(f1.totalDegree, f2.totalDegree, 1);
    const degreeSim = 1 - Math.abs(f1.totalDegree - f2.totalDegree) / maxDegree;

    // Role similarity (hub, source, sink)
    let roleSim = 0;
    if (f1.isHub === f2.isHub) roleSim += 0.33;
    if (f1.isSource === f2.isSource) roleSim += 0.33;
    if (f1.isSink === f2.isSink) roleSim += 0.34;

    // Relation type similarity (Jaccard on relation types)
    const allInTypes = new Set([...f1.inRelationTypes.keys(), ...f2.inRelationTypes.keys()]);
    const allOutTypes = new Set([...f1.outRelationTypes.keys(), ...f2.outRelationTypes.keys()]);

    let inTypeSim = 0;
    if (allInTypes.size > 0) {
      const sharedIn = [...f1.inRelationTypes.keys()].filter((t) => f2.inRelationTypes.has(t)).length;
      inTypeSim = sharedIn / allInTypes.size;
    }

    let outTypeSim = 0;
    if (allOutTypes.size > 0) {
      const sharedOut = [...f1.outRelationTypes.keys()].filter((t) => f2.outRelationTypes.has(t)).length;
      outTypeSim = sharedOut / allOutTypes.size;
    }

    const typeSim = (inTypeSim + outTypeSim) / 2;

    // Weighted combination
    return 0.3 * degreeSim + 0.3 * roleSim + 0.4 * typeSim;
  }

  /**
   * Compute similarity between two concepts based on their structural role
   */
  private computeConceptSimilarity(
    source: CausalNode,
    target: CausalNode,
    sourceSlice: ToposSlice,
    targetSlice: ToposSlice
  ): number {
    const sourceFeatures = this.computeNodeFeatures([source], sourceSlice.morphisms);
    const targetFeatures = this.computeNodeFeatures([target], targetSlice.morphisms);

    const sf = sourceFeatures.get(source.id);
    const tf = targetFeatures.get(target.id);

    if (!sf || !tf) return 0;

    return this.computeFeatureSimilarity(sf, tf);
  }

  /**
   * Get a specific slice by domain
   */
  getSlice(domain: string): ToposSlice | undefined {
    return this.slices.get(domain);
  }

  /**
   * Get all slices
   */
  getAllSlices(): ToposSlice[] {
    return Array.from(this.slices.values());
  }
}

interface NodeFeature {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  inRelationTypes: Map<RelationType, number>;
  outRelationTypes: Map<RelationType, number>;
  isHub: boolean;
  isSource: boolean;
  isSink: boolean;
}

/**
 * Create a slice manager from a CausalGraph
 */
export function createSliceManager(graph: CausalGraph): SliceManager {
  const manager = new SliceManager(graph);
  manager.computeSlices();
  return manager;
}
