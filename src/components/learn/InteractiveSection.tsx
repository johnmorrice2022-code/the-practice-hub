import CirclePartsToggle from '@/components/diagrams/CirclePartsToggle';
import MeckGentToggle from '@/components/diagrams/MeckGentToggle';
import MeckGentCards from '@/components/diagrams/MeckGentCards';

/**
 * Registry of interactive components renderable inside LearningContent.
 * To add a new one: build the component, import it here, add a key below.
 *
 * DB usage:
 *   learning_content row → content JSONB:
 *   { "type": "interactive", "component": "circle-parts-toggle" }
 *   { "type": "interactive", "component": "meck-gent" }
 *   { "type": "interactive", "component": "meck-gent-cards" }
 */
const INTERACTIVE_COMPONENTS: Record<string, React.ComponentType> = {
  'circle-parts-toggle': CirclePartsToggle,
  'meck-gent': MeckGentToggle,
  'meck-gent-cards': MeckGentCards,
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
