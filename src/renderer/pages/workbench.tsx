import { Boxes, Sparkles, Wrench } from 'lucide-react';

import {
  PagePanelBody,
  PagePanelHeader,
  PageSurface,
} from '@/components/layout/page-canvas/PageCanvas';
import { Badge } from '@/components/ui/badge';

const highlights = [
  {
    icon: Wrench,
    title: '工具化操作',
    description: '将 ERP 重复性操作封装为独立工具，一键批量执行。',
  },
  {
    icon: Boxes,
    title: '模块化扩展',
    description: '按 PRD 逐步接入业务工具，侧栏导航即开即用。',
  },
  {
    icon: Sparkles,
    title: '本地安全存储',
    description: '凭证加密保存在 userData，界面不回显敏感明文。',
  },
] as const;

export function WorkbenchPage() {
  return (
    <PageSurface>
      <section className="relative shrink-0 overflow-hidden border-b px-6 py-8 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            快麦 ERP 桌面工具箱
          </Badge>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              欢迎使用快麦 ERP 工具箱
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground lg:text-base">
              桌面小工具集合，用于提升快麦 ERP 日常操作效率。请从左侧导航进入各工具，或在设置页配置 ERP
              凭证。
            </p>
          </div>
        </div>
      </section>

      <section className="grid shrink-0 gap-px border-b bg-border sm:grid-cols-2 xl:grid-cols-3">
        {highlights.map((item) => (
          <div key={item.title} className="flex flex-col gap-3 bg-background p-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <item.icon />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="flex min-h-0 flex-1 flex-col">
        <PagePanelHeader
          title="工具列表"
          description="当前暂无已注册工具，后续将按 PRD 逐步接入"
        />
        <PagePanelBody className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Boxes className="text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">暂无可用工具</p>
              <p className="text-xs text-muted-foreground">接入后将显示在工作台与侧栏导航中</p>
            </div>
          </div>
        </PagePanelBody>
      </div>
    </PageSurface>
  );
}
