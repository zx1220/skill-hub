---
name: code-gen
description: >
  基于docs/output技术方案文档的生产级Java代码自动生成。自动读取技术方案、接口规范、业务规则，
  严格按项目分层架构（Controller→Manage→Service→Mapper）生成可直接上线的代码。
  强制执行阿里巴巴Java开发手册规范、权限控制、事务边界、并发安全、幂等性。
  Trigger on "生成代码", "根据方案生成代码", "自动生成代码", "方案生成", "生成接口代码"。
---

# 生产级代码自动生成

## 触发条件

用户说 "生成代码"、"根据方案生成代码"、"自动生成代码"、"方案生成"、"生成接口代码" 时触发。

## 执行流程

### 第一步：读取技术方案（强制，不可跳过）

1. 列出 `docs/output/` 下所有文件，按修改时间排序，优先使用最新文件
2. 逐个读取以下文档（按文件名关键词匹配）：
   - **技术方案**（`tech-spec*.md`）：功能点描述、接口清单、数据库变更、业务规则
   - **接口规范**（`interface_spec*.md`）：接口路径、请求参数、响应结构、错误码
   - **功能描述**（`function_desc*.md`）：业务逻辑细节、边界条件、特殊处理
3. 如果 `docs/output/` 为空或不存在，**停止执行**，提示用户先放置技术方案文档

### 第二步：业务理解与方案梳理

输出以下内容，让用户确认理解是否正确：

```
## 业务理解
- 核心需求：（一句话概括）
- 涉及模块：（列出功能点）
- 影响范围：（新增/修改哪些接口）

## 实现思路
- 分层设计：Controller → Manage → Service → Mapper 各层职责
- 数据库变更：DDL / 数据补全（如涉及）
- 特殊处理：（并发、幂等、权限等）

## 注意事项
- 权限：@CheckToken / @CheckAuth 策略
- 事务：事务边界和传播机制
- 并发：分布式锁 / 幂等方案
- 边界：参数校验、空值处理
```

**等待用户确认后再生成代码。** 用户说"继续"、"没问题"、"开始"等即视为确认。

### 第三步：代码生成

按以下顺序生成，每个文件输出完整可运行代码。

#### 3.1 分层结构

严格遵循项目四层架构：

```
Controller（REST路由）→ Manage（业务编排+事务）→ Service（单表CRUD）→ Mapper（数据库访问）
```

**判断是否需要 Manage 层**：
- 涉及多表操作、事务、分布式锁 → 必须有 Manage 层
- 纯单表查询 → 可以省略 Manage，Controller 直接调 Service

#### 3.2 代码生成规则

##### PO（实体类）

```java
@Data
@TableName("table_name")
public class XxxPo {
    @TableId(type = IdType.AUTO)
    private Long id;
    // 字段严格按技术方案的数据库设计
    private String delFlag;  // 软删除标识 "0"正常 "1"删除
    private Date createTime;
    private Date updateTime;
}
```

##### DTO / VO

```java
@Data
public class XxxReq {
    @NotBlank(message = "xxx不能为空")
    private String xxx;
}

@Data
public class XxxResp {
    // 响应字段严格按接口规范
}
```

##### Mapper

```java
@Mapper
public interface XxxMapper extends BaseMapper<XxxPo> {
    // 复杂查询写在 XML 中：resources/mapper/XxxMapper.xml
}
```

XML Mapper 仅在 BaseMapper 无法满足时才创建，不生成空文件。

##### Service

```java
public interface XxxService extends IService<XxxPo> {
    // 接口方法
}

@Service
@Slf4j
public class XxxServiceImpl extends ServiceImpl<XxxMapper, XxxPo> implements XxxService {
    // 实现
}
```

##### Manage（如需要）

```java
@Service
@Slf4j
public class XxxManage {
    @Transactional("masterTransactionManager")
    public Result<XxxResp> doSomething(XxxReq req) {
        // 业务编排：调用多个 Service，事务控制，分布式锁
    }
}
```

##### Controller

```java
@RestController
@RequestMapping("/module")
@Slf4j
public class XxxController {
    @PostMapping("/action-V1")
    @CheckToken
    public Result<XxxResp> action(@RequestBody @Valid XxxReq req) {
        // 调用 Manage 或 Service
    }
}
```

#### 3.3 强制质量检查清单

生成代码时逐项自检，不满足的必须修正：

| 维度 | 要求 |
|:---|:---|
| **命名** | 类名大驼峰、方法名小驼峰、常量全大写下划线、PO后缀`Po`、Mapper后缀`Mapper` |
| **参数校验** | 入参使用 `@NotBlank`/`@NotNull`/`@Valid`，不手动写if-null判断 |
| **统一返回** | 方法返回 `Result<T>`，不返回裸对象 |
| **异常处理** | 业务异常抛 `BusinessException`，不catch后返回null |
| **事务** | 写操作 `@Transactional("masterTransactionManager")`，只读不加 |
| **日志** | 关键入口打印入参（`log.info("method param: {}", req)`），异常打印堆栈 |
| **权限** | 需要登录 `@CheckToken`，需要权限 `@CheckAuth` |
| **软删除** | 查询条件带 `del_flag = '0'`，删除操作更新 `del_flag = '1'` |
| **并发** | 涉及资源竞争用 `@UseLock` 或 Redis 分布式锁 |
| **幂等** | 写操作考虑重复提交防护 |

#### 3.4 数据库变更（如涉及）

如果技术方案包含 DDL 变更，生成对应的 SQL：

```sql
-- 表结构变更
ALTER TABLE xxx ADD COLUMN column_name varchar(32) DEFAULT NULL COMMENT '注释';

-- 历史数据补全（如需要）
UPDATE xxx SET column_name = value WHERE column_name IS NULL;
```

### 第四步：生成后验证

代码生成完毕后，执行以下检查：

1. **编译检查**：`mvn compile -q` 确保无编译错误
2. **依赖检查**：确认引用的类在本项目中存在（如 `Result`、`BusinessException`、`@CheckToken` 等）
3. **路径检查**：确认文件放在正确的包路径下

如果编译失败，自动修复后重新验证。

## 输出格式规范

### 代码文件输出顺序

1. **PO** — 数据库实体
2. **Mapper + XML**（如有复杂SQL）— 数据访问层
3. **Service 接口 + 实现** — 业务逻辑层
4. **Manage**（如需要）— 业务编排层
5. **DTO/VO** — 请求响应对象
6. **Controller** — 接口层
7. **SQL**（如涉及DDL）— 数据库变更

### 文件头注释（仅保留必要信息）

```java
// 不写文件头注释，不写@author，不写@date
// 代码本身的命名和方法签名就是最好的文档
```

### 禁止事项

- 不生成无用的 `toString()`、`hashCode()`、`equals()`（Lombok `@Data` 已包含）
- 不生成空实现的接口方法
- 不生成未使用的工具方法"以防万一"
- 不生成多余的抽象层或设计模式（不需要的 Factory、Strategy 就不写）
- 不在代码中写 TODO 或 FIXME
- 不生成测试代码（除非用户明确要求）
- 不生成 Swagger 注解（除非技术方案明确要求）
- 不生成无业务意义的注释（如 `// 设置名称`）
- 不生成 `@Autowired` 字段注入，使用构造器注入或 `@Resource`

## 项目技术栈参考

- Java 8 / Spring Boot / Spring Cloud (TSF)
- MyBatis-Plus（BaseMapper + XML）
- FastJSON 解析，Jackson 序列化
- Redis（分布式锁、缓存）
- RabbitMQ（异步消息）
- Apollo（配置中心）
- Log4j2 + SLF4J（`@Slf4j`）
- MapStruct（对象转换）

## 与现有代码的集成

生成代码前，先搜索项目中已有的相关代码：
1. 搜索是否已有同功能的 Controller/Service，避免重复创建
2. 如果是修改现有接口，基于现有代码改造，不从头重写
3. 引用的工具类、常量类、枚举优先使用项目中已有的
4. 接口版本号：新增接口用 V1，修改现有接口确认当前版本号后递增
