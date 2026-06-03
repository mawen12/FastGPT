# Api

## 数据存储

- Mongodb

### Schema

```bash
> db.createCollections('apps', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["teamId", "tmbId", "name"],
            properties: {
                parentId: {
                    bsonType: ["objectId", "null"],
                    description: "父级应用/文件夹 ID"
                },
                teamId: {
                    bsonType: "objectId",
                    description: "团队 ID"
                },
                tmbId: {
                    bsonType: "objectId",
                    description: "团队成员 ID"
                },
                name: {
                    bsonType: "string",
                    description: "应用名称"
                },
                type: {
                    bsonType: "string",
                    enum: ["folder", "toolFolder", "simple", "chatAgent", "advanced", "plugin", "toolSet", "httpToolSet", "hidden"],
                    description: "应用类型"
                },
                version: {
                    bsonType: "string",
                    enum: ["v1", "v2"],
                    description: "版本"
                },
                avatar: {
                    bsonType: "string",
                    description: "应用头像"
                },
                intro: {
                    bsonType: "string",
                    description: "应用介绍"
                },
                templateId: {
                    bsonType: "string",
                    description: "使用的模板ID"
                },
                updateTime: {
                    bsonType: "date",
                    description: "更新时间"
                },
                modules: {
                    bsonType: "array",
                },
                edges: {
                    bsonType: "array"
                },
                chatConfig: {
                    bsonType: "object"
                },
                pluginData: {
                    bsonType: "object",
                    properties: {
                        nodeVersion: { bsonType: "string" },
                        pluginUniId: { bsonType: "string" },
                        apiSchemaStr: { bsonType: "string" },
                        customHeaders: { bsonType: "string" },
                    }
                },
                scheduledTriggerConfig: {
                    bsonType: "object",
                    properties: {
                        cronString: { bsonType: "string" },
                        timezone: { bsonType: "string" },
                        defaultPrompt: { bsonType: "string" }
                    }
                },
                scheduledTriggerNextTime: {
                    bsonType: "date"
                },
                resourceRefs: {
                    bsonType: "object",
                    properties: {
                        skillIds: {
                            bsonType: "array",
                            items: {
                                bsonType: "string"
                            }
                        }
                    }
                },
                inheritPermission: {
                    bsonType: "bool"
                },
                favourite: {
                    bsonType: "bool"
                },
                quick: {
                    bsonType: "bool"
                },
                defaultPermission: {
                    bsonType: "number"
                },
                inited: {
                    bsonType: "bool"
                },
                teamTags: {
                    bsonType: "array",
                    items: {
                        bsonType: "string"
                    }
                },
                deleteTime: {
                    bsonType: ["date", "null"],
                    description: "删除时间"
                }
            }
        }
    },
    validationAction: "warn",
    validationLevel: "moderate"
});

> db.apps.createIndex({ teamId: 1, updateTime: -1 });
> db.apps.createIndex({ teamId: 1, type: 1 });
> db.apps.createIndex({ teamId: 1, deleteTime: 1, "resourceRefs.skillIds": 1 });
> db.apps.createIndex({ scheduledTriggerConfig: 1, scheduledTriggerNextTime: -1 }, { partialFilterExpression: { scheduledTriggerConfig: { $exists: true } }})

> db.apps.createIndex({ type: 1 });
> db.apps.createIndex({ deleteTime: 1 });
> db.apps.createIndex({ name: 1 });
```

## 接口调用

| 接口 | 用途 | 定义 | 后端 | 
| --- | --- | --- | --- |
| `POST /core/app/create` | 创建 app 的通用接口 | projects/app/src/web/core/app/api.ts | projects/app/src/pages/api/core/app/create.ts |
| `POST /core/app/list` | 获取 app 列表 | projects/app/src/web/core/app/api.ts | projects/app/src/pages/api/core/app/list.ts |

