import MarkdownIt from 'markdown-it'

/**
 * Markdown 渲染器配置
 */
const md = new MarkdownIt({
  html: true,        // 允许 HTML 标签
  linkify: true,     // 自动转换 URL 为链接
  typographer: true, // 优化排版
  breaks: true       // 换行符转换为 <br>
})

/**
 * 渲染完整 Markdown 内容
 * @param text Markdown 文本
 * @returns HTML 字符串
 */
export function renderMarkdown(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return ''
  return md.render(text)
}

/**
 * 渲染行内 Markdown 内容（不包裹 <p> 标签）
 * @param text Markdown 文本
 * @returns HTML 字符串
 */
export function renderInlineMarkdown(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return ''
  return md.renderInline(text)
}

/**
 * 渲染消息内容
 * 自动处理空内容和代码块
 * @param content 消息内容
 * @returns HTML 字符串
 */
export function renderMessageContent(content: string | null | undefined): string {
  if (!content || typeof content !== 'string') return ''
  
  // 检测是否包含代码块
  const hasCodeBlock = content.includes('```')
  
  if (hasCodeBlock) {
    // 代码块需要完整渲染
    return renderMarkdown(content)
  }
  
  // 普通文本使用行内渲染
  return renderMarkdown(content)
}

/**
 * 转义 HTML 特殊字符
 * 用于显示原始代码
 * @param text 原始文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return ''
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  
  return text.replace(/[&<>"']/g, char => htmlEntities[char] || char)
}

/**
 * 提取代码块内容
 * @param content 包含代码块的文本
 * @param language 指定语言（可选）
 * @returns 代码内容数组
 */
export function extractCodeBlocks(content: string | null | undefined, language?: string): string[] {
  if (!content || typeof content !== 'string') return []
  const blocks: string[] = []
  const regex = language 
    ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'g')
    : /```[\w]*\n([\s\S]*?)\n```/g
  
  let match
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1])
  }
  
  return blocks
}