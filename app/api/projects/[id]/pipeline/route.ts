// DEMOCRITUS - Pipeline Data API
// Save and load pipeline data (topics, questions, statements, triples) for a project

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for pipeline data - matches frontend types
const pipelineSchema = z.object({
  topics: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })).optional(),
  questions: z.array(z.object({
    id: z.string(),
    topicId: z.string().optional(),
    text: z.string(),
    questionType: z.string().optional(),
  })).optional(),
  statements: z.array(z.object({
    id: z.string(),
    questionId: z.string().optional(),
    text: z.string(),
    confidence: z.number().optional(),
    source: z.string().optional(),
  })).optional(),
  triples: z.array(z.object({
    id: z.string(),
    statementId: z.string().optional(),
    subject: z.string(),
    predicate: z.string(),
    object: z.string(),
    relationType: z.string().optional(),
    confidence: z.number().optional(),
  })).optional(),
});

// GET - Load pipeline data for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Load all pipeline data
    const [topics, questions, statements, dbTriples] = await Promise.all([
      prisma.topic.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.question.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
        include: { topic: true },
      }),
      prisma.statement.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.triple.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
        include: { source: true, target: true },
      }),
    ]);

    // Transform to frontend format
    const transformedTriples = dbTriples.map((t) => ({
      id: t.id,
      statementId: t.statementId,
      subject: t.source.name,
      predicate: t.relationType,
      object: t.target.name,
      relationType: t.relationType,
      confidence: t.confidence,
    }));

    const transformedQuestions = questions.map((q) => ({
      id: q.id,
      topicId: q.topicId,
      text: q.text,
      questionType: q.type,
    }));

    return NextResponse.json({
      project,
      pipeline: {
        topics: topics.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })),
        questions: transformedQuestions,
        statements: statements.map((s) => ({
          id: s.id,
          questionId: s.questionId,
          text: s.text,
          confidence: s.confidence,
          source: s.mechanism, // Map mechanism to source
        })),
        triples: transformedTriples,
      },
    });
  } catch (error) {
    console.error('Failed to load pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to load pipeline data' },
      { status: 500 }
    );
  }
}

// Helper to get or create a concept
async function getOrCreateConcept(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  name: string
) {
  const normalizedName = name.toLowerCase().trim();

  let concept = await tx.concept.findFirst({
    where: { normalizedName },
  });

  if (!concept) {
    concept = await tx.concept.create({
      data: {
        name,
        normalizedName,
      },
    });
  }

  return concept;
}

// PUT - Save pipeline data to a project (replaces existing data)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const pipelineData = pipelineSchema.parse(body);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Use a transaction to replace all pipeline data
    await prisma.$transaction(async (tx) => {
      // Delete existing data in reverse order (due to foreign keys)
      await tx.triple.deleteMany({ where: { projectId: id } });
      await tx.statement.deleteMany({ where: { projectId: id } });
      await tx.question.deleteMany({ where: { projectId: id } });
      await tx.topic.deleteMany({ where: { projectId: id } });

      // Create new topics
      if (pipelineData.topics && pipelineData.topics.length > 0) {
        await tx.topic.createMany({
          data: pipelineData.topics.map((t) => ({
            id: t.id,
            projectId: id,
            name: t.name,
            description: t.description,
          })),
        });
      }

      // Get topic IDs for questions
      const topicIds = new Set((pipelineData.topics || []).map((t) => t.id));

      // Create new questions
      if (pipelineData.questions && pipelineData.questions.length > 0) {
        for (const q of pipelineData.questions) {
          // Ensure topicId exists, use first topic if not specified
          const validTopicId = q.topicId && topicIds.has(q.topicId)
            ? q.topicId
            : (pipelineData.topics && pipelineData.topics.length > 0 ? pipelineData.topics[0].id : null);

          if (validTopicId) {
            await tx.question.create({
              data: {
                id: q.id,
                projectId: id,
                topicId: validTopicId,
                text: q.text,
                type: q.questionType || 'general',
                variables: '[]', // Default empty variables
              },
            });
          }
        }
      }

      // Create new statements
      if (pipelineData.statements && pipelineData.statements.length > 0) {
        await tx.statement.createMany({
          data: pipelineData.statements.map((s) => ({
            id: s.id,
            projectId: id,
            questionId: s.questionId,
            text: s.text,
            confidence: s.confidence || 1.0,
            mechanism: s.source, // Map source to mechanism
          })),
        });
      }

      // Create new triples (need to create concepts first)
      if (pipelineData.triples && pipelineData.triples.length > 0) {
        for (const t of pipelineData.triples) {
          // Get or create source and target concepts
          const sourceConcept = await getOrCreateConcept(tx, t.subject);
          const targetConcept = await getOrCreateConcept(tx, t.object);

          // Check if this triple already exists
          const existing = await tx.triple.findFirst({
            where: {
              sourceId: sourceConcept.id,
              targetId: targetConcept.id,
              relationType: t.relationType || t.predicate,
            },
          });

          if (!existing) {
            await tx.triple.create({
              data: {
                id: t.id,
                projectId: id,
                sourceId: sourceConcept.id,
                targetId: targetConcept.id,
                relationType: t.relationType || t.predicate,
                confidence: t.confidence || 1.0,
                statementId: t.statementId,
              },
            });
          }
        }
      }

      // Update project timestamp
      await tx.project.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save pipeline:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid pipeline data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save pipeline data' },
      { status: 500 }
    );
  }
}

// POST - Append pipeline data to a project (adds to existing data)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const pipelineData = pipelineSchema.parse(body);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Use a transaction to add new pipeline data
    await prisma.$transaction(async (tx) => {
      // Get existing topic IDs
      const existingTopics = await tx.topic.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const existingTopicIds = new Set(existingTopics.map((t) => t.id));

      // Create new topics (skip duplicates)
      if (pipelineData.topics && pipelineData.topics.length > 0) {
        const newTopics = pipelineData.topics.filter((t) => !existingTopicIds.has(t.id));
        if (newTopics.length > 0) {
          await tx.topic.createMany({
            data: newTopics.map((t) => ({
              id: t.id,
              projectId: id,
              name: t.name,
              description: t.description,
            })),
          });
        }
      }

      // Update topic set with new topics
      const allTopicIds = new Set([
        ...existingTopicIds,
        ...(pipelineData.topics || []).map((t) => t.id),
      ]);

      // Get existing question IDs
      const existingQuestions = await tx.question.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));

      // Create new questions
      if (pipelineData.questions && pipelineData.questions.length > 0) {
        for (const q of pipelineData.questions) {
          if (existingQuestionIds.has(q.id)) continue;

          const validTopicId = q.topicId && allTopicIds.has(q.topicId)
            ? q.topicId
            : (allTopicIds.size > 0 ? Array.from(allTopicIds)[0] : null);

          if (validTopicId) {
            await tx.question.create({
              data: {
                id: q.id,
                projectId: id,
                topicId: validTopicId,
                text: q.text,
                type: q.questionType || 'general',
                variables: '[]',
              },
            });
          }
        }
      }

      // Get existing statement IDs
      const existingStatements = await tx.statement.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const existingStatementIds = new Set(existingStatements.map((s) => s.id));

      // Create new statements
      if (pipelineData.statements && pipelineData.statements.length > 0) {
        const newStatements = pipelineData.statements.filter(
          (s) => !existingStatementIds.has(s.id)
        );
        if (newStatements.length > 0) {
          await tx.statement.createMany({
            data: newStatements.map((s) => ({
              id: s.id,
              projectId: id,
              questionId: s.questionId,
              text: s.text,
              confidence: s.confidence || 1.0,
              mechanism: s.source,
            })),
          });
        }
      }

      // Create new triples
      if (pipelineData.triples && pipelineData.triples.length > 0) {
        for (const t of pipelineData.triples) {
          const sourceConcept = await getOrCreateConcept(tx, t.subject);
          const targetConcept = await getOrCreateConcept(tx, t.object);

          // Check if this triple already exists
          const existing = await tx.triple.findFirst({
            where: {
              sourceId: sourceConcept.id,
              targetId: targetConcept.id,
              relationType: t.relationType || t.predicate,
            },
          });

          if (!existing) {
            await tx.triple.create({
              data: {
                id: t.id,
                projectId: id,
                sourceId: sourceConcept.id,
                targetId: targetConcept.id,
                relationType: t.relationType || t.predicate,
                confidence: t.confidence || 1.0,
                statementId: t.statementId,
              },
            });
          }
        }
      }

      // Update project timestamp
      await tx.project.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to append pipeline data:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid pipeline data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to append pipeline data' },
      { status: 500 }
    );
  }
}
