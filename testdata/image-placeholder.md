# 图片占位与重试

验证图片加载失败的占位与重试入口（悬停不出现，失败即显示）。

## 正常远程图片

![placeholder](https://placehold.co/300x100?text=markview+test)

## 失效远程图片（应显示占位 + 重试按钮）

![broken remote](https://example.com/definitely-missing-404.png)

## 失效本地图片（同样显示占位）

![broken local](./no-such-image.png)

## 父相对路径本地图片（应正常加载）

![logo](../images/logo.svg)
