import { ActionPanel, Detail, List, LocalStorage, Action, showToast, Toast, Icon, Color, Form } from "@raycast/api";
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

  return (
    <List
      filtering={false} searchText={searchText} onSearchTextChange={setSearchText}>
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
                <Action.Push icon={Icon.ChevronRight} title="Ask Question" target={<ChatgptView question={realQuestion} template={template} />} />
                <Action.Push icon={Icon.Key} title="Add API Key" target={<ApiKey />} />
                <Action.Push icon={Icon.Plus} title="Create Template" target={
                  <TemplateForm submitHandle={loadTemplates} />
                } />
                <Action.Push icon={Icon.Document} title="Update Template" target={
                  <TemplateForm template={template} submitHandle={loadTemplates} />
                } />
                <Action icon={Icon.DeleteDocument} title="Delete Template" onAction={() => {
                  const data = templates.filter((item: any) => item.id !== template.id)
                  LocalStorage.setItem(templatesKey, JSON.stringify(data))
                  setTemplates(data)
                }} />
              </ActionPanel>
            }
          />
        }) :
          <List.Item
            title='Hello World'
            icon={Icon.SpeechBubbleActive}
            actions={
              <ActionPanel>
                <Action.Push icon={Icon.Key} title="Add API Key" target={<ApiKey />} />
                <Action.Push icon={Icon.Plus} title="Create Template" target={
                  <TemplateForm submitHandle={loadTemplates} />
                } />
              </ActionPanel>
            }
          />
      }
    </List>
  );
}

function TemplateForm(props: { template?: Template, submitHandle: () => void }) {

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
  return <Form actions={
    <ActionPanel>
      <Action.SubmitForm title="Submit" onSubmit={createOrUpdate} />
    </ActionPanel>
  }>
    <Form.TextField id='title' title='Title' defaultValue={props.template?.title ?? ''} />
    <Form.TextArea id='prompt' title='Prompt' defaultValue={props.template?.prompt ?? ''} />
    <Form.TextField id='max_tokens' title='Max Tokens' defaultValue={props.template?.max_tokens ? `${props.template?.max_tokens}` : ''} />
  </Form>
}

function ApiKey() {
  const [apiKey, setApiKey] = useState('');
  useEffect(() => {
    LocalStorage.getItem<string>("api_key").then(key => { setApiKey(key ?? '') })
  }, [])

  return <Form actions={
    <ActionPanel>
      <Action.SubmitForm title="Submit" onSubmit={(values) => {
        LocalStorage.setItem("api_key", values.api_key).then(() => {
          showToast({ style: Toast.Style.Success, title: "保存成功" });
        })
      }} />
    </ActionPanel>
  }>
    <Form.TextField id='api_key' title='API Key' value={apiKey} />
  </Form>;
}

function ChatgptView(props: { question: string, template: Template }) {
  const buildMarkdown = (answer: string | undefined) => {
    return `* **question**:   ${props.question} \n\n * **max tokens**:   ${props.template.max_tokens} \n\n * **answer**: \n\n ${answer}`
  }

  const [detailContent, setDetailContent] = useState({ answer: '', markdown: buildMarkdown(''), isLoading: true })

  const queryAndUpdate = async () => {
    try {
      const start = Date.now()
      const apiKey = await LocalStorage.getItem<string>("api_key")
      const configuration = new Configuration({
        apiKey: apiKey,
      });
      const response = await (new OpenAIApi(configuration)).createCompletion({
        model: "text-davinci-003",
        prompt: props.question,
        max_tokens: props.template.max_tokens,
      })
      const answer = response.data.choices[0].text ?? ''
      setDetailContent({ answer: answer ?? '', markdown: buildMarkdown(answer), isLoading: false })
      showToast({ style: Toast.Style.Success, title: "查询完成", message: `耗时 ${(Date.now() - start) / 1000}s` })
    } catch (err) {
      console.log(err)
      showToast({ style: Toast.Style.Failure, title: "查询失败", message: JSON.stringify(err), })
    }
  }

  useEffect(() => { queryAndUpdate() }, [])

  return <Detail markdown={detailContent.markdown} isLoading={detailContent.isLoading} actions={
    <ActionPanel>
      <Action icon={Icon.RotateClockwise} title="Refresh" onAction={() => {
        setDetailContent({ answer: '', markdown: buildMarkdown(''), isLoading: true })
        queryAndUpdate()
      }} />
    </ActionPanel>
  }
  />
}
