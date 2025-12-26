export interface CodeGeneratorConfig {
  base_indent: number;
  insert_space_around_operators?: boolean;
  global_prefix?: string;

  loop: {
    header: string;
    footer: string;
  };

  type: {
    int: string;
    float: string;
    str: string;
    // Add other types if needed, or make it a Record<string, string>
  };

  default: {
    int: string;
    float: string;
    str: string;
  };

  arg: {
    int: string;
    float: string;
    str: string;
    seq: string;
    "2d_seq": string;
  };

  actual_arg: {
    seq: string;
    "2d_seq": string;
  };

  access: {
    seq: string;
    "2d_seq": string;
  };

  declare: {
    int: string;
    float: string;
    str: string;
    seq: string;
    "2d_seq": string;
  };

  allocate: {
    seq: string;
    "2d_seq": string;
  };

  declare_and_allocate: {
    seq: string;
    "2d_seq": string;
  };

  input: {
    int: string;
    float: string;
    str: string;
  };
}

export interface TemplateContext {
  mod?: number;
  yes_str?: string;
  no_str?: string;
  prediction_success: boolean;
  formal_arguments: string;
  actual_arguments: string;
  input_part: string;
  atcodertools: {
    version: string;
    url: string;
  };
}
