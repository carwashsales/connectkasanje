export const mockUpload = () => {};

export const supabaseMock = {
  storage: {
    from: () => ({
      upload: async (path:any, file:any, opts:any) => ({ data: { path }, error: null }),
      getPublicUrl: (path:any) => ({ data: { publicUrl: `https://example.com/${path}` } }),
    }),
  },
};

export default supabaseMock;
