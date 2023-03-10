import { ActionPanel, Cache, Detail, List, LocalStorage, Action, showToast, Toast, Icon, Color, Form } from "@raycast/api";
import { Configuration, OpenAIApi } from "openai";
import util from 'util';
import { useEffect, useState } from "react";

interface Template {
  id: number,
  title: string,
  prompt: string,
  max_tokens: number
}

const templatesKey = "templates"

export default function Command() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchText, setSearchText] = useState("");

  const loadTemplates = () => {
    LocalStorage.getItem<string>(templatesKey).then(templatesStr => {
      if (templatesStr) {
        console.log(templatesStr)
        setTemplates(JSON.parse(templatesStr))
      }
    })
  }
  useEffect(loadTemplates, [])


  cache.clear()

  return (
    <List
      filtering={false}
      searchText={searchText}
      onSearchTextChange={setSearchText}>
      {
        templates.length > 0 ? templates.map((template, idx) => {
          const realQuestion = util.format(template.prompt, searchText)
          return <List.Item
            key={template.id}
            icon={{ source: Icon.SpeechBubbleActive, tintColor: [Color.Red, Color.Yellow, Color.Blue, Color.Green][idx % 4] }}
            title={template.title}
            subtitle={realQuestion}
            actions={
              <ActionPanel>
                <Action.Push title="Show Details" target={<ChatgptView question={realQuestion} template={template} />} />
                <ActionPanel.Section>
                  <AddApiKey />
                  <CreateOrUpdateTemplate title="Create Template" submitHandle={loadTemplates} />
                  <CreateOrUpdateTemplate title="Update Template" template={template} submitHandle={loadTemplates} />
                  <Action icon={Icon.DeleteDocument} title="Delete Template" onAction={async () => {
                    const data = templates.filter((item: any) => item.id !== template.id)
                    LocalStorage.setItem(templatesKey, JSON.stringify(data))
                    setTemplates(data)
                  }} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        }) :
          <List.Item
            title='Hello World'
            icon={Icon.SpeechBubbleActive}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <AddApiKey />
                  <CreateOrUpdateTemplate title="Create Template" submitHandle={loadTemplates} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
      }
    </List>
  );
}

function CreateOrUpdateTemplate(props: { title: string, template?: Template, submitHandle: () => void }) {

  const createOrUpdate = async (values: any) => {
    try {
      const old = JSON.parse((await LocalStorage.getItem(templatesKey)) ?? '[]')
      if (props.template) {
        const idx = old.findIndex((item: any) => item.id === props.template?.id)
        old[idx] = { ...values, max_tokens: parseInt(values.max_tokens), id: props.template?.id }
      } else {
        old.push({ ...values, id: Date.now(), max_tokens: parseInt(values.max_tokens) })
      }

      await LocalStorage.setItem(templatesKey, JSON.stringify(old))
      props.submitHandle()
      showToast({ style: Toast.Style.Success, title: "保存成功", });

    } catch (err) {
      showToast({ style: Toast.Style.Failure, title: "保存失败", });
    }
  }
  return <Action.Push
    icon={props.template ? Icon.Document : Icon.Plus}
    title={props.title}
    target={
      <Form actions={
        <ActionPanel>
          <Action.SubmitForm title="Submit" onSubmit={createOrUpdate} />
        </ActionPanel>
      }>
        <Form.TextField id='title' title='Title' defaultValue={props.template?.title ?? ''} />
        <Form.TextArea id='prompt' title='Prompt' defaultValue={props.template?.prompt ?? ''} />
        <Form.TextField id='max_tokens' title='Max Tokens' defaultValue={props.template?.max_tokens ? `${props.template?.max_tokens}` : ''} />
      </Form>
    } />
}

function AddApiKey() {
  const [apiKey, setApiKey] = useState('');
  LocalStorage.getItem<string>("api_key").then(key => setApiKey(key ?? ''))

  return <Action.Push
    icon={Icon.Key}
    title="Add API Key"
    target={
      <Form actions={
        <ActionPanel>
          <Action.SubmitForm title="Submit" onSubmit={(values) => {
            LocalStorage.setItem("api_key", values.api_key).then(() => {
              showToast({
                style: Toast.Style.Success,
                title: "保存成功",
              });
            })
          }} />
        </ActionPanel>
      }>
        <Form.TextField id='api_key' title='API Key' defaultValue={apiKey} />
      </Form>
    } />
}

function ChatgptView(props: { question: string, template: Template }) {
  const buildMarkdown = (answer: string | undefined) => {
    return `* **question**:   ${props.question} \n\n * **max tokens**:   ${props.template.max_tokens} \n\n * **answer**: \n\n ${answer}`
  }

  const [markdown, setMarkdown] = useState<string>(buildMarkdown(''))

  const toasts = {
    running: {
      style: Toast.Style.Animated,
      title: "查询中"
    }, fail: {
      style: Toast.Style.Failure,
      title: "查询失败"
    }, ok: {
      style: Toast.Style.Success,
      title: "查询成功"
    },
  }

  useEffect(() => {
    showToast(toasts.running)
    const start = Date.now()
    queryQuestion(props.question, props.template.max_tokens).then(answer => {
      setMarkdown(buildMarkdown(answer))
      showToast({ ...toasts.ok, message: `耗时 ${(Date.now() - start) / 1000}s` })
    }).catch(err => {
      console.log(err)
      showToast({ ...toasts.fail, message: JSON.stringify(err), })
    })
  }, [])


  return <Detail markdown={markdown} />
}

const cache = new Cache();
async function queryQuestion(question: string, max_tokens: number) {
  cache.set(question, cache.get(question) ?? '')

  let answer = cache.get(question)
  if (answer !== '') {
    return answer
  }
  const apiKey = await LocalStorage.getItem<string>("api_key")
  const configuration = new Configuration({
    apiKey: apiKey,
  });
  const response = await (new OpenAIApi(configuration)).createCompletion({
    model: "text-davinci-003",
    prompt: question,
    max_tokens: max_tokens,
  })
  answer = response.data.choices[0].text ?? ''
  cache.set(question, answer)
  return answer
}
