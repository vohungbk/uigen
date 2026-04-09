import { anthropic } from "@ai-sdk/anthropic";
import {
  LanguageModelV1,
  LanguageModelV1StreamPart,
  LanguageModelV1Message,
} from "@ai-sdk/provider";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly defaultObjectGenerationMode = "tool" as const;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(messages: LanguageModelV1Message[]): string {
    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "user") {
        const content = message.content;
        if (Array.isArray(content)) {
          // Extract text from content parts
          const textParts = content
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text);
          return textParts.join(" ");
        } else if (typeof content === "string") {
          return content;
        }
      }
    }
    return "";
  }

  private getLastToolResult(messages: LanguageModelV1Message[]): any {
    // Find the last tool message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "tool") {
        const content = messages[i].content;
        if (Array.isArray(content) && content.length > 0) {
          return content[0];
        }
      }
    }
    return null;
  }

  private async *generateMockStream(
    messages: LanguageModelV1Message[],
    userPrompt: string
  ): AsyncGenerator<LanguageModelV1StreamPart> {
    // Count tool messages to determine which step we're on
    const toolMessageCount = messages.filter((m) => m.role === "tool").length;

    // Determine component type from the original user prompt
    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("card")) {
      componentType = "card";
      componentName = "Card";
    }

    // Step 1: Create component file
    if (toolMessageCount === 1) {
      const text = `I'll create a ${componentName} component for you.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(25);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_1`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "create",
          path: `/components/${componentName}.jsx`,
          file_text: this.getComponentCode(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 2: Enhance component
    if (toolMessageCount === 2) {
      const text = `Now let me enhance the component with better styling.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(25);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_2`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "str_replace",
          path: `/components/${componentName}.jsx`,
          old_str: this.getOldStringForReplace(componentType),
          new_str: this.getNewStringForReplace(componentType),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 3: Create App.jsx
    if (toolMessageCount === 0) {
      const text = `This is a static response. You can place an Anthropic API key in the .env file to use the Anthropic API for component generation. Let me create an App.jsx file to display the component.`;
      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(15);
      }

      yield {
        type: "tool-call",
        toolCallType: "function",
        toolCallId: `call_3`,
        toolName: "str_replace_editor",
        args: JSON.stringify({
          command: "create",
          path: "/App.jsx",
          file_text: this.getAppCode(componentName),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: {
          promptTokens: 50,
          completionTokens: 30,
        },
      };
      return;
    }

    // Step 4: Final summary (no tool call)
    if (toolMessageCount >= 3) {
      const text = `Perfect! I've created:

1. **${componentName}.jsx** - A fully-featured ${componentType} component
2. **App.jsx** - The main app file that displays the component

The component is now ready to use. You can see the preview on the right side of the screen.`;

      for (const char of text) {
        yield { type: "text-delta", textDelta: char };
        await this.delay(30);
      }

      yield {
        type: "finish",
        finishReason: "stop",
        usage: {
          promptTokens: 50,
          completionTokens: 50,
        },
      };
      return;
    }
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [focused, setFocused] = useState(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('Message sent!');
  };

  const inputStyle = (field) => ({
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: focused === field ? '2px solid #e94560' : '2px solid #2a2a3e',
    padding: '10px 0',
    color: '#f0f0f0',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  const labelStyle = { display: 'block', fontSize: '10px', fontWeight: '700', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8892a4', marginBottom: '4px' };

  return (
    <div style={{ background: '#12121f', padding: '48px', maxWidth: '420px' }}>
      <h2 className="text-3xl font-black mb-2" style={{ color: '#f0f0f0', letterSpacing: '-0.04em' }}>Get in Touch</h2>
      <p className="text-sm mb-10" style={{ color: '#8892a4' }}>We respond within 24 hours.</p>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label style={labelStyle}>Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange}
            onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
            required style={inputStyle('name')} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange}
            onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
            required style={inputStyle('email')} />
        </div>
        <div>
          <label style={labelStyle}>Message</label>
          <textarea name="message" value={formData.message} onChange={handleChange}
            onFocus={() => setFocused('message')} onBlur={() => setFocused(null)}
            required rows={3} style={{ ...inputStyle('message'), resize: 'none' }} />
        </div>
        <button type="submit" className="w-full py-3 font-bold text-xs uppercase tracking-widest transition-opacity duration-200 hover:opacity-80"
          style={{ background: 'linear-gradient(90deg, #e94560, #f5a623)', color: '#fff', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
          Send Message
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `import React from 'react';

const Card = ({
  title = "Welcome to Our Service",
  description = "Discover amazing features and capabilities that will transform your experience.",
  imageUrl,
  actions
}) => {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #e94560, #f5a623)' }} />
      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-48 object-cover opacity-80"
        />
      )}
      <div className="p-8">
        <h3 className="text-2xl font-black tracking-tight mb-3" style={{ color: '#f0f0f0', letterSpacing: '-0.03em' }}>{title}</h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: '#8892a4' }}>{description}</p>
        {actions && (
          <div className="mt-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  const btnStyle = (accent) => ({
    width: '48px', height: '48px', borderRadius: '0', border: \`1px solid \${accent}\`,
    background: 'transparent', color: accent, fontSize: '20px', fontWeight: '700',
    cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div className="flex flex-col items-center" style={{ background: '#12121f', padding: '56px 40px' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: '#8892a4', letterSpacing: '0.2em' }}>Counter</p>
      <div className="font-black mb-10" style={{ fontSize: '96px', lineHeight: 1, color: '#f0f0f0', letterSpacing: '-0.06em', fontVariantNumeric: 'tabular-nums' }}>
        {count < 0 ? <span style={{ color: '#e94560' }}>{count}</span> : count}
      </div>
      <div className="flex gap-3">
        <button style={btnStyle('#e94560')} onClick={() => setCount(c => c - 1)}
          onMouseOver={e => Object.assign(e.currentTarget.style, { background: '#e94560', color: '#fff' })}
          onMouseOut={e => Object.assign(e.currentTarget.style, { background: 'transparent', color: '#e94560' })}>
          −
        </button>
        <button style={{ ...btnStyle('#2a2a3e'), color: '#8892a4', borderColor: '#2a2a3e', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', width: 'auto', padding: '0 16px' }}
          onClick={() => setCount(0)}>
          RESET
        </button>
        <button style={btnStyle('#4ade80')} onClick={() => setCount(c => c + 1)}
          onMouseOver={e => Object.assign(e.currentTarget.style, { background: '#4ade80', color: '#12121f' })}
          onMouseOut={e => Object.assign(e.currentTarget.style, { background: 'transparent', color: '#4ade80' })}>
          +
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    console.log('Form submitted:', formData);";
      case "card":
        return '      <div className="p-6">';
      default:
        return "  const increment = () => setCount(count + 1);";
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    console.log('Form submitted:', formData);\n    alert('Thank you! We\\'ll get back to you soon.');";
      case "card":
        return '      <div className="p-6 hover:bg-gray-50 transition-colors">';
      default:
        return "  const increment = () => setCount(prev => prev + 1);";
    }
  }

  private getAppCode(componentName: string): string {
    if (componentName === "Card") {
      return `import Card from '@/components/Card';

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#0d0d14' }}>
      <div className="w-full max-w-sm">
        <Card
          title="Amazing Product"
          description="This is a fantastic product that will change your life. Experience the difference today!"
          actions={
            <button
              className="text-xs font-bold uppercase tracking-widest px-6 py-3 transition-all duration-200"
              style={{ background: 'linear-gradient(90deg, #e94560, #f5a623)', color: '#fff', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              Learn More
            </button>
          }
        />
      </div>
    </div>
  );
}`;
    }

    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#0d0d14' }}>
      <div className="w-full max-w-md">
        <${componentName} />
      </div>
    </div>
  );
}`;
  }

  async doGenerate(
    options: Parameters<LanguageModelV1["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);

    // Collect all stream parts
    const parts: LanguageModelV1StreamPart[] = [];
    for await (const part of this.generateMockStream(
      options.prompt,
      userPrompt
    )) {
      parts.push(part);
    }

    // Build response from parts
    const textParts = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as any).textDelta)
      .join("");

    const toolCalls = parts
      .filter((p) => p.type === "tool-call")
      .map((p) => ({
        toolCallType: "function" as const,
        toolCallId: (p as any).toolCallId,
        toolName: (p as any).toolName,
        args: (p as any).args,
      }));

    // Get finish reason from finish part
    const finishPart = parts.find((p) => p.type === "finish") as any;
    const finishReason = finishPart?.finishReason || "stop";

    return {
      text: textParts,
      toolCalls,
      finishReason: finishReason as any,
      usage: {
        promptTokens: 100,
        completionTokens: 200,
      },
      warnings: [],
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        },
      },
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        try {
          const generator = self.generateMockStream(options.prompt, userPrompt);
          for await (const chunk of generator) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      warnings: [],
      rawCall: {
        rawPrompt: options.prompt,
        rawSettings: {},
      },
      rawResponse: { headers: {} },
    };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude-sonnet-4-0");
  }

  return anthropic(MODEL);
}
