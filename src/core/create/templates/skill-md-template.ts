export function generateSkillMdTemplate(formData: {
  name: string;
  description: string;
  whenToUse?: string;
  whenNotToUse?: string;
  whatToBuild?: string;
  steps?: string;
  definitionOfDone?: string;
}): string {
  const sections: string[] = [];

  // YAML front matter
  sections.push('---');
  sections.push(`name: ${formData.name}`);
  sections.push(`description: ${formData.description}`);
  sections.push('---');
  sections.push('');

  // When to use this
  if (formData.whenToUse) {
    sections.push('# When to use this');
    sections.push('');
    sections.push(formData.whenToUse);
    sections.push('');
  }

  // When NOT to use this
  if (formData.whenNotToUse) {
    sections.push('# When NOT to use this');
    sections.push('');
    sections.push(formData.whenNotToUse);
    sections.push('');
  }

  // What to build
  if (formData.whatToBuild) {
    sections.push('# What to build');
    sections.push('');
    sections.push(formData.whatToBuild);
    sections.push('');
  }

  // Steps
  if (formData.steps) {
    sections.push('# Steps');
    sections.push('');
    sections.push(formData.steps);
    sections.push('');
  }

  // Definition of done
  if (formData.definitionOfDone) {
    sections.push('# Definition of done');
    sections.push('');
    sections.push(formData.definitionOfDone);
    sections.push('');
  }

  return sections.join('\n');
}