import CirclePartsToggle from '@/components/diagrams/CirclePartsToggle';

/**
 * Registry of interactive components renderable inside LearningContent.
 * To add a new one: build the component, import it here, add a key below.
 *
 * DB usage:
 *   learning_content row → content JSONB:
 *   { "type": "interactive", "component": "circle-parts-toggle" }
 */
const INTERACTIVE_COMPONENTS: Record<string, React.ComponentType> = {
  'circle-parts-toggle': CirclePartsToggle,
};

interface InteractiveSectionProps {
  component: string;
}

export default function InteractiveSection({
  component,
}: InteractiveSectionProps) {
  const Component = INTERACTIVE_COMPONENTS[component];

  if (!Component) {
    console.warn(`InteractiveSection: unknown component "${component}"`);
    return null;
  }

  return <Component />;
}
