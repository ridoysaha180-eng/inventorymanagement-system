with open('src/types.ts', 'r') as f:
    content = f.read()

types_to_add = """
export type Brand = {
  id: string;
  name: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type SubCategory = {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
};
"""

with open('src/types.ts', 'a') as f:
    f.write(types_to_add)
